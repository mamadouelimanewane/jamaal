/**
 * Règle un paiement Versus : relit le paiement chez Versus (jamais le contenu d'un webhook) et ne valide
 * que s'il est COMPLETED, pour la même commande et le montant exact. Utilisé par le webhook ET par la
 * page de commande, pour que le paiement (ou l'acompte de réservation) soit pris en charge même si le
 * webhook n'est jamais arrivé : plus d'oubli possible après qu'un client a payé.
 */
import { prisma } from "@/lib/prisma";
import { DEPOSIT_PREFIX } from "@/lib/wallet";
import { markOrderPaid } from "./mark-paid";
import { getVersusPayment, isVersusRef, orderIdFromReference, rawVersusRef, versusCredentials } from "./versus";

export type SettleResult = "paid" | "failed" | "pending" | "unknown";

export async function settleVersusPayment(id: string): Promise<SettleResult> {
  // Même passerelle en pause, un paiement lancé chez Versus avant la bascule est encore réglé.
  if (!versusCredentials()) return "unknown";
  const isDeposit = id.startsWith(DEPOSIT_PREFIX);

  // Référence de paiement enregistrée à la création (jamais celle d'un message reçu).
  const stored = isDeposit
    ? (await prisma.walletTransaction.findUnique({ where: { id: id.slice(DEPOSIT_PREFIX.length) }, select: { providerRef: true } }))?.providerRef
    : (await prisma.order.findUnique({ where: { id }, select: { paymentRef: true } }))?.paymentRef;
  if (!stored) return "unknown";
  // Paiement Wave en direct (référence sans préfixe « versus: ») : ce n'est pas un paiement Versus.
  if (!isVersusRef(stored) && /^cos-/i.test(stored)) return "unknown";

  const payment = await getVersusPayment(rawVersusRef(stored));
  if (!payment || orderIdFromReference(payment.externalReference) !== id) return "unknown";

  if (payment.status === "COMPLETED") {
    if (payment.currency && payment.currency !== "XOF") return "unknown";
    const method = isDeposit ? "WAVE" : (await prisma.order.findUnique({ where: { id }, select: { paymentMethod: true } }))?.paymentMethod;
    if (method !== "WAVE" && method !== "ORANGE_MONEY" && method !== "STRIPE") return "unknown";
    const ok = await markOrderPaid(id, { method, externalRef: stored, amount: payment.amount });
    return ok ? "paid" : "unknown";
  }
  return /^(FAILED|REJECTED|CANCELLED)$/.test(payment.status) ? "failed" : "pending";
}
