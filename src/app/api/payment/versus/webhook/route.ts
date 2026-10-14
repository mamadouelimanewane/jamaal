import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { markOrderPaid } from "@/lib/payment/mark-paid";
import { getVersusPayment, orderIdFromReference, rawVersusRef, versusConfigured } from "@/lib/payment/versus";
import { DEPOSIT_PREFIX } from "@/lib/wallet";
import { alertPaymentFailed } from "@/lib/whatsapp/alerts";

/**
 * Webhook Versus Business (TRANSACTION_STATUS).
 * À déclarer chez Versus : https://votre-domaine/api/payment/versus/webhook?token=<VERSUS_WEBHOOK_TOKEN>
 *
 * Versus ne signe pas ses webhooks : le corps reçu n'est donc jamais cru. On retrouve la
 * référence du paiement enregistrée à la création, on relit le paiement chez Versus et on ne
 * valide que s'il est COMPLETED, pour la même commande et le montant exact.
 */
export async function POST(req: NextRequest) {
  if (!versusConfigured()) return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });

  const expected = process.env.VERSUS_WEBHOOK_TOKEN;
  if (expected) {
    const given = req.nextUrl.searchParams.get("token") ?? "";
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { type?: string; external_reference?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Les instructions de paiement n'ont rien à traiter de notre côté.
  if (body.type !== "TRANSACTION_STATUS" || !body.external_reference) return NextResponse.json({ received: true });

  const id = orderIdFromReference(String(body.external_reference));
  const isDeposit = id.startsWith(DEPOSIT_PREFIX);

  // Référence de paiement Versus enregistrée à la création (jamais celle du webhook).
  const stored = isDeposit
    ? (await prisma.walletTransaction.findUnique({ where: { id: id.slice(DEPOSIT_PREFIX.length) }, select: { providerRef: true } }))?.providerRef
    : (await prisma.order.findUnique({ where: { id }, select: { paymentRef: true } }))?.paymentRef;
  if (!stored) return NextResponse.json({ received: true });

  const payment = await getVersusPayment(rawVersusRef(stored));
  if (!payment || orderIdFromReference(payment.externalReference) !== id) return NextResponse.json({ received: true });

  if (payment.status === "COMPLETED") {
    if (payment.currency && payment.currency !== "XOF") return NextResponse.json({ error: "currency mismatch" }, { status: 400 });
    const method = isDeposit ? "WAVE" : (await prisma.order.findUnique({ where: { id }, select: { paymentMethod: true } }))?.paymentMethod;
    if (method === "WAVE" || method === "ORANGE_MONEY" || method === "STRIPE") {
      await markOrderPaid(id, { method, externalRef: stored, amount: payment.amount });
    }
  } else if (!isDeposit && /^(FAILED|REJECTED|CANCELLED)$/.test(payment.status)) {
    alertPaymentFailed(id, "Versus");
  }

  return NextResponse.json({ received: true });
}
