"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { setCommissionRate } from "@/lib/settings";

export async function updateCommissionRate(formData: FormData) {
  await requireAdmin();
  const rate = Number(formData.get("rate") ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux invalide");
  await setCommissionRate(rate);
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin");
}
