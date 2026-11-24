"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { setCommissionRate, setSponsorCommissionRate, setLoyaltySettings } from "@/lib/settings";
import { setGmdRate, setMruRate } from "@/lib/fx";

async function updateCommissionRateImpl(formData: FormData) {
  await requireAdmin("reglages");
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}

async function updateSponsorCommissionRateImpl(formData: FormData) {
  await requireAdmin("reglages");
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setSponsorCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}

async function updateLoyaltySettingsActionImpl(formData: FormData) {
  await requireAdmin("reglages");
  const earningRate = Number(formData.get("earningRate") ?? 1);
  const spendThreshold = Number(formData.get("spendThreshold") ?? 10000);
  await setLoyaltySettings(earningRate, spendThreshold);
  revalidatePath("/admin/reglages");
  revalidatePath("/admin");
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function updateCommissionRate(formData: FormData): Promise<void> {
  try {
    await updateCommissionRateImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/comptabilite");
  }
}

export async function updateSponsorCommissionRate(formData: FormData): Promise<void> {
  try {
    await updateSponsorCommissionRateImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/comptabilite");
  }
}

export async function updateLoyaltySettingsAction(formData: FormData): Promise<void> {
  try {
    await updateLoyaltySettingsActionImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/comptabilite");
  }
}

async function updateMruRateImpl(formData: FormData) {
  await requireAdmin("reglages");
  const rate = Number(String(formData.get("mruRate") ?? "").replace(",", "."));
  if (!Number.isFinite(rate) || rate < 1 || rate > 100) throw new Error("Taux invalide : indiquez combien de FCFA vaut 1 ouguiya (ex. 14,7).");
  await setMruRate(Math.round(rate * 1000) / 1000);
  revalidatePath("/admin/reglages");
  revalidatePath("/ar", "layout");
}

/** Taux de conversion FCFA → ouguiya de la version arabe du site. */
export async function updateMruRateAction(formData: FormData): Promise<void> {
  try {
    await updateMruRateImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/reglages");
  }
}

async function updateGmdRateImpl(formData: FormData) {
  await requireAdmin("reglages");
  const rate = Number(String(formData.get("gmdRate") ?? "").replace(",", "."));
  if (!Number.isFinite(rate) || rate < 1 || rate > 100) throw new Error("Taux invalide : indiquez combien de FCFA vaut 1 dalasi (ex. 8,1).");
  await setGmdRate(Math.round(rate * 1000) / 1000);
  revalidatePath("/admin/reglages");
  revalidatePath("/en", "layout");
}

/** Taux de conversion FCFA → dalasi de la version anglaise (gambienne) du site. */
export async function updateGmdRateAction(formData: FormData): Promise<void> {
  try {
    await updateGmdRateImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/reglages");
  }
}
