"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { releaseAllHeld, resolveFlag, scanMembers } from "@/lib/fraud/run";
import { setFraudControl } from "@/lib/fraud/settings";

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

/** Suspend ou réactive le contrôle anti-fraude des commissions. */
export async function setFraudControlAction(on: boolean): Promise<{ ok: boolean; message?: string }> {
  const session = await requireAdmin("comptabilite");
  await setFraudControl(on);
  await logActivity(session, on ? "Contrôle anti-fraude réactivé" : "Contrôle anti-fraude suspendu", "Setting", "antifraude_actif");
  revalidatePath("/admin/fraude");
  return { ok: true, message: on ? "Contrôle réactivé : les nouvelles ventes sont de nouveau contrôlées." : "Contrôle suspendu : les commissions sont créditées et retirables tout de suite." };
}

/** Libère toutes les commissions en vérification et les rend retirables. */
export async function releaseAllHeldAction(): Promise<{ ok: boolean; message?: string }> {
  const session = await requireAdmin("comptabilite");
  const r = await releaseAllHeld(session.user?.id ?? null);
  await logActivity(session, `Commissions en vérification libérées (${r.count})`, "FraudFlag", "tout");
  revalidatePath("/admin/fraude");
  return { ok: true, message: r.count ? `${r.count} commission(s) libérée(s) : elles sont retirables.` : "Aucune commission en vérification." };
}
