"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireConsultantProfile } from "./auth-guard";
import { upsertCustomerFromOrder } from "@/lib/customers";
import { notifySponsorOnFirstSale } from "@/lib/sponsor-notifications";
import { decrementStockAndAlert } from "@/lib/stock";

import { LOYALTY_REDEEM_VALUE_FCFA } from "@/lib/loyalty";
import { priceItemsFromCatalog } from "@/lib/order-pricing";
import { getBusinessModel } from "@/lib/business-model-store";
import { isValidPoint, newDeliveryCode, quoteDelivery, roadKm } from "@/lib/delivery";
import { debitCollectedForOrder, debitForOrder, walletBalance, WalletError } from "@/lib/wallet";
import { activeTerms, allowedCollect, collectRef, isCollectMethod, parseZones } from "@/lib/special-terms";
import { runPayoutsForOrder } from "@/lib/payouts/engine";
import { after } from "next/server";
import { getAvailablePaymentProviders } from "@/lib/payment";
import { PAY_LINK_REF } from "@/lib/pay-link";
import { notifyOrderUpdate } from "@/lib/whatsapp/order-notify";
import type { Prisma } from "@prisma/client";

export interface ConsultantOrderItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
}

export type ConsultantOrderState = { ok: boolean; error?: string };

/**
 * Formulaire « Nouvelle commande » du vendeur. Les erreurs de saisie sont renvoyées au
 * formulaire : en production, Next.js masque le message d'une erreur levée et affiche une
 * page « A server error occurred ».
 */
export async function createConsultantOrder(_prev: ConsultantOrderState, formData: FormData): Promise<ConsultantOrderState> {
  let orderId: string;
  try {
    orderId = await placeConsultantOrder(formData);
  } catch (e) {
    const internal = !(e instanceof Error) || /^PrismaClient/.test(e.constructor.name);
    if (internal) console.error("[commande vendeur]", e);
    return { ok: false, error: internal ? "La commande n'a pas pu être enregistrée, réessayez." : e.message };
  }
  redirect(`/admin/mes-commandes/${orderId}${formData.get("payLink") === "on" ? "?lien=1" : ""}`);
}

async function placeConsultantOrder(formData: FormData): Promise<string> {
  const { consultant } = await requireConsultantProfile();

  // Articles : seuls l'identifiant, le format et la quantité viennent du formulaire ; les prix
  // sont relus dans le catalogue (un vendeur ne peut pas modifier un prix).
  let rawItems: ConsultantOrderItem[];
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    throw new Error("Articles invalides");
  }
  const { items, total: productsTotal } = await priceItemsFromCatalog(rawItems);

  const customerName = String(formData.get("customerName") ?? "").trim().slice(0, 120);
  const customerPhone = String(formData.get("customerPhone") ?? "").trim().slice(0, 30);
  if (customerName.length < 2) throw new Error("Indiquez le nom du client.");
  const clientAddress = String(formData.get("address") ?? "").trim().slice(0, 500) || null;
  const useLoyaltyPoints = formData.get("useLoyaltyPoints") === "on";
  // Conditions spéciales du revendeur (encaissement direct, zones de livraison propres).
  const terms = activeTerms(consultant.specialTermsId ? await prisma.specialTerms.findUnique({ where: { id: consultant.specialTermsId } }) : null);

  // Où livrer : retrait (le consultant remet lui-même), chez le client, ou chez le consultant
  // quand il achète pour le compte de son client.
  const target = String(formData.get("deliveryTarget") ?? "RETRAIT");
  const point = { lat: Number(formData.get("deliveryLat")), lng: Number(formData.get("deliveryLng")) };
  let deliveryData: Record<string, unknown> = { deliveryMode: "RETRAIT_CONSULTANT" };
  let address = clientAddress;
  let deliveryNote = "";
  if (target === "CLIENT" || target === "VENDEUR") {
    if (!isValidPoint(point)) throw new Error("Placez le point de livraison sur la carte.");
    let contactName = customerName;
    let contactPhone = customerPhone || null;
    if (target === "CLIENT") {
      if (!clientAddress) throw new Error("Indiquez l'adresse de livraison du client.");
      deliveryNote = "Livraison chez le client";
    } else {
      const myAddress = String(formData.get("vendorAddress") ?? "").trim().slice(0, 500) || consultant.deliveryAddress;
      if (!myAddress) throw new Error("Indiquez votre adresse de livraison.");
      address = `${myAddress} (chez ${consultant.name}, consultant·e, pour ${customerName})`;
      contactName = consultant.name;
      contactPhone = consultant.whatsapp;
      deliveryNote = `Livraison chez ${consultant.name} (achat pour le client)`;
      if (formData.get("saveVendorAddress") === "on") {
        await prisma.consultant.update({ where: { id: consultant.id }, data: { deliveryAddress: myAddress, deliveryLat: point.lat, deliveryLng: point.lng } });
      }
    }
    const model = await getBusinessModel();
    // Zone spéciale du revendeur : tarif fixe de la zone, sans limite de distance.
    const zoneName = String(formData.get("specialZone") ?? "").trim();
    const zone = zoneName ? parseZones(terms?.zones).find((z) => z.name === zoneName) : undefined;
    if (zoneName && !zone) throw new Error("Cette zone de livraison n'est plus proposée : choisissez-en une autre.");
    const quote = zone
      ? { ok: true as const, distanceKm: roadKm({ lat: model.depotLat, lng: model.depotLng }, point), fee: zone.fee, livreurShare: Math.round((zone.fee * model.livreurSharePct) / 100) }
      : quoteDelivery(point, productsTotal, model);
    if (!quote.ok) throw new Error(quote.error);
    if (zone) deliveryNote = `${deliveryNote} · zone ${zone.name}`;
    deliveryData = {
      deliveryMode: "LIVRAISON_JAMAAL",
      deliveryTarget: target,
      deliveryContactName: contactName,
      deliveryContactPhone: contactPhone,
      deliveryLat: point.lat,
      deliveryLng: point.lng,
      deliveryFee: quote.fee,
      deliveryDistanceKm: quote.distanceKm,
      deliveryCode: newDeliveryCode(),
      deliveryStatus: "A_PREPARER",
      livreurShare: quote.livreurShare,
      deliveryApprox: formData.get("deliveryApprox") === "1",
      deliveryPlace: String(formData.get("deliveryPlace") ?? "").trim().slice(0, 120) || zone?.name || null,
    };
  }

  // Paiement avec le wallet du vendeur : solde vérifié avant tout (montant maximal, avant remise fidélité).
  const payWithWallet = formData.get("payWithWallet") === "on";
  // Encaissement direct (conditions spéciales) : le client a payé le revendeur en espèces, Wave ou Orange Money.
  const collectRaw = String(formData.get("collect") ?? "");
  const collect = collectRaw && collectRaw !== "NON" ? collectRaw : null;
  if (collect && (!isCollectMethod(collect) || !allowedCollect(terms).includes(collect))) throw new Error("Ce moyen d'encaissement n'est pas autorisé pour votre compte.");
  if (collect && payWithWallet) throw new Error("Choisissez soit « payer avec mon wallet », soit « mon client m'a payé ».");
  // Lien de paiement : le client règle lui-même en ligne (Wave ou Orange Money) ; livraison et commissions après paiement.
  const payLink = formData.get("payLink") === "on";
  if (payLink && (payWithWallet || collect)) throw new Error("Choisissez un seul mode de paiement : lien au client, wallet ou client déjà payé.");
  if (payLink) {
    const online = getAvailablePaymentProviders(await getBusinessModel()).filter((p) => p.id !== "cod");
    if (!online.length) throw new Error("Le paiement en ligne n'est pas encore activé : choisissez un autre mode de paiement.");
    if (!customerPhone) throw new Error("Indiquez le WhatsApp du client pour lui envoyer le lien de paiement.");
  }
  if (payWithWallet) {
    const { balance } = await walletBalance({ type: "CONSULTANT", id: consultant.id });
    const max = productsTotal + Number(deliveryData.deliveryFee ?? 0);
    if (balance < max) throw new WalletError(`Solde du wallet insuffisant : ${balance.toLocaleString("fr-FR")} F pour ${max.toLocaleString("fr-FR")} F. Rechargez votre wallet ou choisissez un autre paiement.`);
  }

  let discountAmount = 0;
  const customerId = customerPhone
    ? await upsertCustomerFromOrder({ name: customerName, phone: customerPhone, address: clientAddress })
    : null;

  if (customerId && useLoyaltyPoints) {
    const cust = await prisma.customer.findUnique({ where: { id: customerId } });
    if (cust && cust.loyaltyPoints > 0) {
      const redemptionValue = LOYALTY_REDEEM_VALUE_FCFA;
      discountAmount = Math.min(productsTotal, cust.loyaltyPoints * redemptionValue);
      const pointsToDeduct = Math.ceil(discountAmount / redemptionValue);
      await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { decrement: pointsToDeduct } } });
    }
  }
  const total = productsTotal - discountAmount + Number(deliveryData.deliveryFee ?? 0);

  const orderData = {
      customerName,
      customerPhone: customerPhone || null,
      address,
      total,
      discountAmount,
      customerId,
      consultantId: consultant.id,
      channel: "REVENDEUR",
      ...deliveryData,
      status: "CONFIRMEE",
      statusHistory: { create: { status: "CONFIRMEE" } },
      items: { create: items },
      ...(deliveryData.deliveryStatus && !payLink ? { deliveryEvents: { create: { status: "A_PREPARER", note: `${deliveryNote} · ${deliveryData.deliveryDistanceKm} km du dépôt` } } } : {}),
      // Lien de paiement : la livraison ne part en préparation qu'une fois le paiement reçu (markOrderPaid).
      ...(payLink ? { deliveryStatus: null, paymentMethod: "WAVE" as const, paymentStatus: "EN_ATTENTE" as const, paymentRef: PAY_LINK_REF } : {}),
      ...(payWithWallet ? { paymentMethod: "WALLET" as const, paymentStatus: "PAYE" as const, paidAt: new Date(), paymentRef: "wallet" } : {}),
      ...(collect && isCollectMethod(collect) ? { paymentMethod: "WALLET" as const, paymentStatus: "PAYE" as const, paidAt: new Date(), paymentRef: collectRef(collect) } : {}),
  } satisfies Prisma.OrderUncheckedCreateInput;
  const order = payWithWallet || collect
    ? await prisma.$transaction(async (tx) => {
        const o = await tx.order.create({ data: orderData });
        if (collect && isCollectMethod(collect)) await debitCollectedForOrder(tx, { type: "CONSULTANT", id: consultant.id }, o.id, total, collect, terms?.creditLimit ?? 0, null);
        else await debitForOrder(tx, { type: "CONSULTANT", id: consultant.id }, o.id, total, null);
        return o;
      })
    : await prisma.order.create({ data: orderData });
  // Payée (wallet ou encaissée par le revendeur) : les commissions de la chaîne sont enregistrées tout de suite.
  if (payWithWallet || collect) after(() => runPayoutsForOrder(order.id));

  await notifySponsorOnFirstSale(consultant.id);
  notifyOrderUpdate(order.id, "CREEE");
  await decrementStockAndAlert(items, { orderId: order.id, userId: null });

  revalidatePath("/admin/mes-commandes");
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/produits");
  return order.id;
}

