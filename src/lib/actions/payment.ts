"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { amountDue } from "@/lib/reservation";
import { prisma } from "@/lib/prisma";
import { getAvailablePaymentProviders, getPaymentProvider, type PaymentProviderId } from "@/lib/payment";
import type { CreatePaymentResult } from "@/lib/payment/types";
import { getBusinessModel } from "@/lib/business-model-store";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

/**
 * Après createOrder : initie le paiement selon le mode choisi.
 * - COD → retourne { redirect: false }
 * - Wave / OM / Stripe → { redirect: true, url }
 */
export async function initiatePayment(orderId: string, method: PaymentProviderId): Promise<CreatePaymentResult & { error?: string }> {
  // Erreurs renvoyées en clair : en production, Next.js masque le message d'une erreur levée.
  try {
    return await startPayment(orderId, method);
  } catch (e) {
    const internal = !(e instanceof Error) || /^PrismaClient/.test(e.constructor.name);
    if (internal) console.error("[paiement]", e);
    return { redirect: false, error: internal ? "Le paiement n'a pas pu démarrer, réessayez." : e.message };
  }
}

async function startPayment(
  orderId: string,
  method: PaymentProviderId
) {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const limited = await rateLimit(`pay:${ip}`, { limit: 10, windowMs: 60_000 });
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
      isReservation: true,
      depositAmount: true,
      depositPaidAt: true,
      reservationStatus: true,
    },
  });

  if (!order) throw new Error("Commande introuvable.");
  if ((order as { paymentStatus?: string }).paymentStatus === "PAYE") {
    throw new Error("Cette commande est déjà payée.");
  }
  const due = amountDue(order);
  if (!due || due.amount <= 0) {
    throw new Error(order.isReservation && order.reservationStatus === "RESERVEE" ? "Acompte reçu : le solde se règle à l'arrivée du produit." : "Rien à payer pour cette commande.");
  }
  if (due.part === "ACOMPTE" && method === "cod") {
    throw new Error("L'acompte de réservation se paie en ligne (Wave ou Orange Money).");
  }

  const provider = getPaymentProvider(method);
  const offered = getAvailablePaymentProviders(await getBusinessModel()).some((p) => p.id === method);
  if (!provider || !provider.available || !offered) {
    throw new Error("Mode de paiement indisponible.");
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3030";

  const result = await provider.createPayment({
    orderId: order.id,
    amount: due.amount,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    successUrl: `${origin.replace(/\/$/, "")}/commande/${order.id}?paid=1`,
    cancelUrl: `${origin.replace(/\/$/, "")}/commande/${order.id}?canceled=1`,
    description: `${due.part === "ACOMPTE" ? "Acompte réservation" : due.part === "SOLDE" ? "Solde réservation" : "Commande"} JAMAAL ${order.id.slice(-8).toUpperCase()}`,
  });

  // Persister méthode + ref
  const methodEnum =
    method === "cod"
      ? "A_LA_LIVRAISON"
      : method === "wave"
        ? "WAVE"
        : method === "orange_money"
          ? "ORANGE_MONEY"
          : "STRIPE";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: methodEnum as never,
      paymentStatus: "EN_ATTENTE",
      paymentRef: result.externalRef ?? null,
    },
  });

  revalidatePath(`/commande/${order.id}`);
  revalidatePath("/admin/commandes");

  return result;
}

