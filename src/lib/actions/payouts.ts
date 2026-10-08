"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { processPayouts, refreshPayout } from "@/lib/payouts/engine";

export type PayoutActionState = { ok: boolean; message?: string; error?: string };

/** Verse maintenant toutes les commissions en attente (membres avec wallet). */
export async function runPendingPayoutsAction(): Promise<PayoutActionState> {
  const session = await requireAdmin();
  const { sent, skipped } = await processPayouts();
  await logActivity(session, `Versements lancés (${sent} envoyé(s), ${skipped} en attente)`, "Payout");
  return { ok: true, message: sent ? `${sent} versement(s) envoyé(s).` : "Aucun versement envoyé : vérifiez les wallets des membres et la configuration." };
}

/** Relance le versement d'un membre après un échec. */
export async function retryPayoutAction(payoutId: string): Promise<void> {
  const session = await requireAdmin();
  const payout = await prisma.payout.findUnique({ where: { id: payoutId }, select: { consultantId: true, status: true } });
  if (!payout || payout.status !== "ECHEC") return;
  await processPayouts([payout.consultantId]);
  await logActivity(session, "Nouvelle tentative de versement", "Payout", payoutId);
}

/** Relit l'état d'un versement en cours chez le prestataire. */
export async function refreshPayoutAction(payoutId: string): Promise<void> {
  await requireAdmin();
  await refreshPayout(payoutId);
  revalidatePath("/admin/versements");
}
