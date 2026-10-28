"use server";

import { revalidatePath } from "next/cache";
import { cleanGiftInfo } from "@/lib/gift/gift";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { OrderStatus } from "@prisma/client";
import { placeOrder, type CheckoutCustomer, type CheckoutDelivery, type CheckoutItem } from "@/lib/orders/place-order";
export type { CheckoutCustomer, CheckoutDelivery, CheckoutItem };
import { setOrderStatus } from "@/lib/orders/status";

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

export async function assignOrderLogistics(id: string, formData: FormData) {
  await requireAdmin("commandes");
  const consultantId = String(formData.get("consultantId") ?? "") || null;
  const livreurId = String(formData.get("livreurId") ?? "") || null;
  const deliveryMode = String(formData.get("deliveryMode") ?? "RETRAIT_CONSULTANT") as
    | "RETRAIT_CONSULTANT"
    | "LIVRAISON_JAMAAL";
  const latRaw = String(formData.get("deliveryLat") ?? "").trim();
  const lngRaw = String(formData.get("deliveryLng") ?? "").trim();

  await prisma.order.update({
    where: { id },
    data: {
      consultantId,
      livreurId,
      deliveryMode,
      deliveryLat: latRaw ? Number(latRaw) : null,
      deliveryLng: lngRaw ? Number(lngRaw) : null,
    },
  });
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${id}`);
  revalidatePath("/admin/mes-livraisons");
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
