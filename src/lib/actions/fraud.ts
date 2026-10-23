"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { resolveFlag, scanMembers } from "@/lib/fraud/run";

export async function decideFraudFlag(flagId: string, decision: "VALIDE" | "FRAUDE"): Promise<{ ok: boolean; message?: string; error?: string }> {
  const session = await requireAdmin("comptabilite");
  const r = await resolveFlag(flagId, decision, session.user?.id ?? null);
  if (!r.ok) return { ok: false, error: "Ce signalement est déjà traité." };
  await logActivity(session, decision === "VALIDE" ? "Signalement levé : commissions libérées" : "Fraude confirmée : commissions annulées", "FraudFlag", flagId);
  revalidatePath("/admin/fraude");
  return { ok: true, message: decision === "VALIDE" ? `Pas de fraude : ${r.count} commission(s) créditée(s).` : `Fraude confirmée : ${r.count} commission(s) annulée(s).` };
}

export async function scanFraudNow(): Promise<{ ok: boolean; message?: string }> {
  const session = await requireAdmin("comptabilite");
  const r = await scanMembers();
  await logActivity(session, "Analyse anti-fraude lancée", "FraudFlag", "scan");
  revalidatePath("/admin/fraude");
  return { ok: true, message: r.nouveaux ? `${r.nouveaux} nouveau(x) signalement(s).` : "Aucun nouveau cas suspect." };
}
