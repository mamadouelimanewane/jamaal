"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payment";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

/**
 * Après createOrder : initie le paiement selon le mode choisi.
 * - COD → retourne { redirect: false }
 * - Wave / OM / Stripe → { redirect: true, url }
 */
export async function initiatePayment(
  orderId: string,
  method: PaymentProviderId
) {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const limited = rateLimit(`pay:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    throw new Error(`Trop de tentatives. Réessayez dans ${limited.retryAfterSec}s.`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      total: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      paymentStatus: true,
    },
  });

  if (!order) throw new Error("Commande introuvable.");
  if ((order as { paymentStatus?: string }).paymentStatus === "PAID") {
    throw new Error("Cette commande est déjà payée.");
  }

  const provider = getPaymentProvider(method);
  if (!provider || !provider.available) {
    throw new Error("Mode de paiement indisponible.");
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3030";

  const result = await provider.createPayment({
    orderId: order.id,
    amount: order.total,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    successUrl: `${origin.replace(/\/$/, "")}/commande/${order.id}?paid=1`,
    cancelUrl: `${origin.replace(/\/$/, "")}/commande/${order.id}?canceled=1`,
    description: `Commande JAMAAL ${order.id.slice(-8).toUpperCase()}`,
  });

  // Persister méthode + ref
  const methodEnum =
    method === "cod"
      ? "COD"
      : method === "wave"
        ? "WAVE"
        : method === "orange_money"
          ? "ORANGE_MONEY"
          : "STRIPE";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: methodEnum as never,
      paymentStatus: method === "cod" ? ("NONE" as never) : ("PENDING" as never),
      paymentRef: result.externalRef ?? null,
    },
  });

  revalidatePath(`/commande/${order.id}`);
  revalidatePath("/admin/commandes");

  return result;
}

/** Marque une commande comme payée (appelé par webhooks). */
export async function markOrderPaid(orderId: string, externalRef?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;

  if ((order as { paymentStatus?: string }).paymentStatus === "PAID") return true;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID" as never,
      paidAt: new Date(),
      ...(externalRef ? { paymentRef: externalRef } : {}),
      status: order.status === "EN_ATTENTE" ? "CONFIRMEE" : order.status,
    },
  });

  // Fidélité : créditer les points (best-effort)
  try {
    const { earnLoyaltyForOrder } = await import("@/lib/actions/loyalty");
    await earnLoyaltyForOrder(orderId);
  } catch (err) {
    console.error("[loyalty] earn failed", err);
  }

  revalidatePath(`/commande/${orderId}`);
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  return true;
}
