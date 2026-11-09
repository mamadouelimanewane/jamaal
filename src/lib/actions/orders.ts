"use server";

import { revalidatePath } from "next/cache";
import { cleanGiftInfo } from "@/lib/gift/gift";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { OrderStatus } from "@prisma/client";
import { placeOrder, type CheckoutCustomer, type CheckoutDelivery, type CheckoutItem } from "@/lib/orders/place-order";
export type { CheckoutCustomer, CheckoutDelivery, CheckoutItem };
import { setOrderStatus } from "@/lib/orders/status";
import type { Prisma } from "@prisma/client";
import { getBusinessModel } from "@/lib/business-model-store";
import { isValidPoint, quoteDelivery } from "@/lib/delivery";
import { advanceDelivery, DeliveryError } from "@/lib/delivery-engine";
import { logActivity } from "@/lib/activity-log";
import { backWithError } from "@/lib/form-error";

/**
 * Crée une commande publique (checkout client).
 * - Rate limit (5 commandes / min / IP)
 * - Valide les données avec Zod
 * - Recalcule les prix et le total côté serveur
 * - Vérifie le stock avant création
 * - Attache le consultant (ref cookie ou choix manuel)
 */
export type CreateOrderResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Passe la commande du panier. Renvoie le message d'erreur au lieu de le lever : en production,
 * Next.js masque les messages des erreurs levées par une action serveur (le client ne verrait
 * qu'un code d'erreur au lieu de « stock insuffisant », « prix modifié »…).
 */
/**
 * Réservation d'un format en rupture : même parcours qu'une commande (prix, livraison, client),
 * sans prise de stock ; le client paie un acompte, le solde à l'arrivée du produit.
 */
export async function createReservation(
  customer: CheckoutCustomer,
  item: CheckoutItem,
  consultantId: string | null,
  acceptCgv: boolean,
  delivery: CheckoutDelivery
): Promise<CreateOrderResult> {
  return createOrder(customer, [item], consultantId, acceptCgv, false, "", delivery, true);
}

export async function createOrder(
  customer: CheckoutCustomer,
  items: CheckoutItem[],
  consultantId?: string | null,
  acceptCgv: boolean = false,
  giftWrap: boolean = false,
  giftMessage: string = "",
  delivery: CheckoutDelivery = { mode: "RETRAIT" },
  reservation: boolean = false,
  couponCode: string = "",
  gift: unknown = null,
  installments: number = 0
): Promise<CreateOrderResult> {
  try {
    // Les options internes (clé de limitation…) ne viennent jamais du navigateur.
    const code = typeof couponCode === "string" ? couponCode.slice(0, 40) : "";
    return { ok: true, id: await placeOrder(customer, items, consultantId, acceptCgv, giftWrap, giftMessage, delivery, reservation, { couponCode: code, gift: giftWrap ? cleanGiftInfo(gift) : undefined, installments: Number(installments) || 0 }) };
  } catch (e) {
    const internal = !(e instanceof Error) || /^PrismaClient/.test(e.constructor.name);
    if (internal) console.error("[commande]", e);
    return { ok: false, error: internal ? "Une erreur est survenue, merci de réessayer." : e.message };
  }
}


export async function updateOrderStatus(id: string, status: OrderStatus) {
  await requireAdmin("commandes");
  await setOrderStatus(id, status);
}

/**
 * Logistique d'une commande (fiche commande, admin) : vendeur, mode de livraison, livreur, position.
 * - Nouveau livreur sur une livraison JAMAAL : attribution complète (pièce d'identité vérifiée, livreur et
 *   client prévenus), comme depuis Livraisons.
 * - Nouvelle position : distance, frais et part du livreur recalculés ; si la commande n'est pas encore
 *   payée, les frais et le total sont mis à jour.
 */
export async function assignOrderLogistics(id: string, formData: FormData) {
  const session = await requireAdmin("commandes");
  const back = `/admin/commandes/${id}`;
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { livreurId: true, deliveryMode: true, deliveryLat: true, deliveryLng: true, deliveryFee: true, total: true, paymentStatus: true, address: true, deliveryStatus: true, status: true },
    });
    if (!order) throw new Error("Commande introuvable.");
    const consultantId = String(formData.get("consultantId") ?? "") || null;
    const livreurId = String(formData.get("livreurId") ?? "") || null;
    const deliveryMode = String(formData.get("deliveryMode") ?? "RETRAIT_CONSULTANT") === "LIVRAISON_JAMAAL" ? "LIVRAISON_JAMAAL" : "RETRAIT_CONSULTANT";
    const latRaw = String(formData.get("deliveryLat") ?? "").trim().replace(",", ".");
    const lngRaw = String(formData.get("deliveryLng") ?? "").trim().replace(",", ".");
    const point = latRaw && lngRaw ? { lat: Number(latRaw), lng: Number(lngRaw) } : null;
    if (point && !isValidPoint(point)) throw new Error("Position invalide : collez un lien de localisation ou vérifiez latitude et longitude.");
    const place = String(formData.get("deliveryPlace") ?? "").trim().slice(0, 120);
    const approx = formData.get("deliveryApprox") === "1";

    const moved = !!point && (point.lat !== order.deliveryLat || point.lng !== order.deliveryLng);
    const data: Prisma.OrderUpdateInput = {
      consultant: consultantId ? { connect: { id: consultantId } } : { disconnect: true },
      deliveryMode,
      deliveryLat: point?.lat ?? null,
      deliveryLng: point?.lng ?? null,
      ...(place ? { deliveryPlace: place } : {}),
      ...(moved ? { deliveryApprox: approx } : {}),
    };
    let feeNote = "";
    if (moved && deliveryMode === "LIVRAISON_JAMAAL") {
      const products = order.total - order.deliveryFee;
      const quote = quoteDelivery(point!, products, await getBusinessModel());
      if (!quote.ok) throw new Error(quote.error ?? "Adresse hors zone de livraison.");
      data.deliveryDistanceKm = quote.distanceKm;
      data.livreurShare = quote.livreurShare;
      if (order.paymentStatus !== "PAYE" && quote.fee !== order.deliveryFee) {
        data.deliveryFee = quote.fee;
        data.total = products + quote.fee;
        feeNote = ` · frais ${order.deliveryFee} → ${quote.fee} F`;
      }
    }
    // Livreur : sur une livraison JAMAAL, l'attribution passe par le circuit de livraison.
    const viaDelivery = deliveryMode === "LIVRAISON_JAMAAL" && livreurId && livreurId !== order.livreurId;
    if (!viaDelivery) data.livreur = livreurId ? { connect: { id: livreurId } } : { disconnect: true };
    if (deliveryMode === "LIVRAISON_JAMAAL" && !order.deliveryStatus && order.status !== "ANNULEE") data.deliveryStatus = "A_PREPARER";

    await prisma.order.update({ where: { id }, data });
    if (moved) await logActivity(session, `Position de livraison modifiée${feeNote}`, "Order", id);

    if (viaDelivery) {
      const l = await prisma.livreur.findFirst({ where: { id: livreurId!, active: true }, select: { name: true, _count: { select: { documents: true } } } });
      if (!l) throw new Error("Livreur introuvable ou inactif.");
      if (!l._count.documents) throw new Error(`Pièce d'identité de ${l.name} manquante : ajoutez-la dans Livreurs › Modifier avant de lui confier une course.`);
      await advanceDelivery(id, "ASSIGNEE", { kind: "admin" }, { livreurId: livreurId!, note: `Attribuée à ${l.name}` });
      await logActivity(session, `Livraison attribuée à ${l.name}`, "Order", id);
    }
  } catch (e) {
    await backWithError(e instanceof DeliveryError ? new Error(e.message) : e, back);
  }
  revalidatePath("/admin/commandes");
  revalidatePath(back);
  revalidatePath("/admin/mes-livraisons");
  revalidatePath("/admin/livraisons");
}

export async function livreurUpdateOrderStatus(id: string, status: OrderStatus) {
  const { livreur } = await requireLivreurProfile();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.livreurId !== livreur.id) return;
  await setOrderStatus(id, status);
  revalidatePath("/admin/mes-livraisons");
}

/** Récupère une commande pour la page de confirmation (données publiques limitées). */
export async function getOrderConfirmation(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      total: true,
      status: true,
      createdAt: true,
      address: true,
      paymentMethod: true,
      paymentStatus: true,
      giftWrap: true,
      giftMessage: true,
      giftFrom: true,
      giftOccasion: true,
      giftVoiceUrl: true,
      subscriptionId: true,
      paidAt: true,
      deliveryMode: true,
      deliveryFee: true,
      isReservation: true,
      depositAmount: true,
      depositPaidAt: true,
      reservationStatus: true,
      reservationDelay: true,
      paymentRef: true,
      channel: true,
      installmentCount: true,
      installmentsPaid: true,
      installmentIntervalDays: true,
      installmentRefs: true,
      consultant: { select: { name: true, city: true, whatsapp: true } },
      items: {
        select: {
          productName: true,
          volumeLabel: true,
          price: true,
          quantity: true,
        },
      },
    },
  });
  return order;
}

/** Articles disponibles, avec les prix actuels, pour un nouvel ajout au panier. */
export async function getOrderItemsForReorder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true, variant: true } } } });
  if (!order) return [];
  return order.items.flatMap((item) => {
    const product = item.product;
    if (!product) return [];
    const available = item.variant?.stock ?? product.stock;
    if (available <= 0) return [];
    const volumes = Array.isArray(product.volumes) ? product.volumes as { label: string; price: number }[] : [];
    const volume = volumes.find((entry) => entry.label === item.volumeLabel);
    const sample = item.volumeLabel.toLowerCase().includes("échantillon");
    const price = volume?.price ?? (sample ? product.testerPrice : product.regularPrice);
    if (!price || price <= 0) return [];
    return [{ productId: product.id, slug: product.slug, name: product.name, volumeLabel: item.volumeLabel, price, quantity: Math.min(item.quantity, available), colorFrom: product.colorFrom, colorTo: product.colorTo }];
  });
}
