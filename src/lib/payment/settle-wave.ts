/**
 * Règle un paiement Wave en direct (API Checkout de Wave Business) : relit la session chez Wave
 * (jamais le seul contenu d'un webhook) et ne valide que si elle est payée, pour la même commande et
 * le montant exact. Appelé par la page de commande et la page « Mon wallet » au retour du client :
 * un paiement n'est jamais oublié, même si le webhook n'est pas configuré ou arrive en retard.
 *
 * Env : WAVE_API_KEY (clé API Wave Business avec l'accès « Checkout »), WAVE_API_BASE (facultatif).
 */
import { prisma } from "@/lib/prisma";
import { DEPOSIT_PREFIX } from "@/lib/wallet";
import { GIFT_PREFIX } from "@/lib/gift/gift";
import { markOrderPaid } from "./mark-paid";
import type { SettleResult } from "./settle-versus";

export interface WaveSession {
  id: string;
  amount: string;
  currency: string;
  client_reference: string | null;
  checkout_status: "open" | "complete" | "expired" | string;
  payment_status: "processing" | "cancelled" | "succeeded" | string;
}

export const waveConfigured = () => !!process.env.WAVE_API_KEY;
const base = () => (process.env.WAVE_API_BASE || "https://api.wave.com/v1").replace(/\/$/, "");

/** Session de paiement Wave (null si introuvable ou Wave injoignable). */
export async function getWaveSession(sessionId: string): Promise<WaveSession | null> {
  const key = process.env.WAVE_API_KEY;
  if (!key || !/^[\w-]{4,80}$/.test(sessionId)) return null;
  try {
    const res = await fetch(`${base()}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as WaveSession;
  } catch {
    return null;
  }
}

/** Décision pure (testée) : la session prouve-t-elle le paiement de cette commande ? */
export function waveVerdict(s: WaveSession | null, id: string): "paid" | "failed" | "pending" | "unknown" {
  if (!s || s.client_reference !== id) return "unknown";
  if (s.currency && s.currency !== "XOF") return "unknown";
  if (s.checkout_status === "complete" && s.payment_status === "succeeded") return "paid";
  if (s.checkout_status === "expired" || s.payment_status === "cancelled") return "failed";
  return "pending";
}

export async function settleWavePayment(id: string): Promise<SettleResult> {
  if (!waveConfigured()) return "unknown";
  const isDeposit = id.startsWith(DEPOSIT_PREFIX);
  const isGift = id.startsWith(GIFT_PREFIX);
  const stored = isGift
    ? (await prisma.giftCard.findUnique({ where: { id: id.slice(GIFT_PREFIX.length) }, select: { paymentRef: true, paymentMethod: true } }).then((g) => (g?.paymentMethod === "STRIPE" ? null : g?.paymentRef)))
    : isDeposit
    ? (await prisma.walletTransaction.findUnique({ where: { id: id.slice(DEPOSIT_PREFIX.length) }, select: { providerRef: true } }))?.providerRef
    : (await prisma.order.findUnique({ where: { id }, select: { paymentRef: true, paymentMethod: true } }).then((o) => (o?.paymentMethod === "WAVE" ? o.paymentRef : null)));
  // Les sessions Wave ont des identifiants « cos-… » ; les références Versus commencent par « versus: ».
  if (!stored || stored.startsWith("versus:")) return "unknown";

  const session = await getWaveSession(stored);
  const verdict = waveVerdict(session, id);
  if (verdict !== "paid") return verdict;
  const ok = await markOrderPaid(id, { method: "WAVE", externalRef: stored, amount: Number(session!.amount) });
  return ok ? "paid" : "unknown";
}
