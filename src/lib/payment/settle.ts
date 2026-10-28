/**
 * Vérifie un paiement en attente auprès du prestataire qui l'a pris en charge (Versus ou Wave en direct),
 * sans jamais se fier à l'adresse de retour ni au seul webhook. Ne lève jamais d'erreur.
 */
import { prisma } from "@/lib/prisma";
import { DEPOSIT_PREFIX } from "@/lib/wallet";
import { settleVersusPayment, type SettleResult } from "./settle-versus";
import { settleWavePayment } from "./settle-wave";
import { PAY_LINK_REF } from "@/lib/pay-link";

export async function settlePendingPayment(id: string): Promise<SettleResult> {
  // Lien de paiement d'un revendeur pas encore ouvert par le client : rien à vérifier chez un prestataire.
  if (!id.includes("_")) {
    const o = await prisma.order.findUnique({ where: { id }, select: { paymentRef: true } }).catch(() => null);
    if (o?.paymentRef === PAY_LINK_REF) return "pending";
  }
  const v = await settleVersusPayment(id).catch(() => "unknown" as const);
  if (v !== "unknown") return v;
  return settleWavePayment(id).catch(() => "unknown" as const);
}

/** Retour d'un dépôt en ligne sur un wallet : vérifie les dépôts en attente des 2 derniers jours. */
export async function settleRecentDeposits(owner: { type: string; id: string }): Promise<void> {
  const pending = await prisma.walletTransaction
    .findMany({
      where: { ownerType: owner.type as never, ownerId: owner.id, kind: "DEPOT", status: "EN_ATTENTE", providerRef: { not: null }, createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } },
      select: { id: true },
      take: 5,
    })
    .catch(() => []);
  for (const t of pending) await settlePendingPayment(`${DEPOSIT_PREFIX}${t.id}`);
}
