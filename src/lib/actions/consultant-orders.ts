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
import { isValidPoint, newDeliveryCode, quoteDelivery } from "@/lib/delivery";

export interface ConsultantOrderItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
}

export async function createConsultantOrder(formData: FormData) {
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
    const quote = quoteDelivery(point, productsTotal, await getBusinessModel());
    if (!quote.ok) throw new Error(quote.error);
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
    };
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

  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone: customerPhone || null,
      address,
      total,
      discountAmount,
      customerId,
      consultantId: consultant.id,
      ...deliveryData,
      status: "CONFIRMEE",
      statusHistory: { create: { status: "CONFIRMEE" } },
      items: { create: items },
      ...(deliveryData.deliveryStatus ? { deliveryEvents: { create: { status: "A_PREPARER", note: `${deliveryNote} · ${deliveryData.deliveryDistanceKm} km du dépôt` } } } : {}),
    },
  });

  await notifySponsorOnFirstSale(consultant.id);
  await decrementStockAndAlert(items);

  revalidatePath("/admin/mes-commandes");
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/produits");
  redirect(`/admin/mes-commandes/${order.id}`);
}

