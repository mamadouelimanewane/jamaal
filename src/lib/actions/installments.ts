"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getInstallmentSettings, saveInstallmentSettings } from "@/lib/installments-store";
import { normalizeInstallments, type InstallmentSettings } from "@/lib/installments";

/** Offre de paiement en plusieurs fois, lue par le panier et le formulaire des revendeurs. */
export async function getInstallmentOffer(): Promise<InstallmentSettings> {
  return getInstallmentSettings();
}

export type InstallmentActionResult = { ok: boolean; message?: string; error?: string };

export async function saveInstallmentSettingsAction(_prev: InstallmentActionResult, formData: FormData): Promise<InstallmentActionResult> {
  const session = await requireAdmin("commandes");
  const min = Number(String(formData.get("minTotal") ?? "").replace(/\s/g, ""));
  const days = Number(formData.get("intervalDays"));
  if (!Number.isInteger(min) || min < 1000) return { ok: false, error: "Montant minimal : 1 000 F au moins." };
  if (!Number.isInteger(days) || days < 7 || days > 45) return { ok: false, error: "Écart entre échéances : de 7 à 45 jours." };
  const s = normalizeInstallments({ enabled: formData.get("enabled") === "on", minTotal: min, maxParts: Number(formData.get("maxParts")), intervalDays: days });
  await saveInstallmentSettings(s);
  await logActivity(session, `Paiement en plusieurs fois : ${s.enabled ? "actif" : "désactivé"}, dès ${s.minTotal} F, jusqu'à ${s.maxParts} fois, tous les ${s.intervalDays} jours`, "Setting");
  revalidatePath("/admin/paiement-echelonne");
  return { ok: true, message: "Réglages enregistrés." };
}
