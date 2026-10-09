"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { setCommissionRate, setSponsorCommissionRate, setLoyaltySettings } from "@/lib/settings";

async function updateCommissionRateImpl(formData: FormData) {
  await requireAdmin();
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}

async function updateSponsorCommissionRateImpl(formData: FormData) {
  await requireAdmin();
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setSponsorCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}

async function updateLoyaltySettingsActionImpl(formData: FormData) {
  await requireAdmin();
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
