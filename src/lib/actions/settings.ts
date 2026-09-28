"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { setCommissionRate, setSponsorCommissionRate, setLoyaltySettings } from "@/lib/settings";

export async function updateCommissionRate(formData: FormData) {
  await requireAdmin();
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}

export async function updateSponsorCommissionRate(formData: FormData) {
  await requireAdmin();
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setSponsorCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}

export async function updateLoyaltySettingsAction(formData: FormData) {
  await requireAdmin();
  const earningRate = Number(formData.get("earningRate") ?? 1);
  const spendThreshold = Number(formData.get("spendThreshold") ?? 10000);
  await setLoyaltySettings(earningRate, spendThreshold);
  revalidatePath("/admin/reglages");
  revalidatePath("/admin");
}
