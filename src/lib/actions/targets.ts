"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

export async function setMonthlyTarget(consultantId: string | null, formData: FormData) {
  const session = await requireAdmin();
  const year = Number(formData.get("year") ?? new Date().getFullYear());
  const month = Number(formData.get("month") ?? new Date().getMonth() + 1);
  const targetRevenue = Number(formData.get("targetRevenue") ?? 0) || 0;

  const existing = await prisma.monthlyTarget.findFirst({ where: { consultantId, year, month } });
  if (existing) {
    await prisma.monthlyTarget.update({ where: { id: existing.id }, data: { targetRevenue } });
  } else {
    await prisma.monthlyTarget.create({ data: { consultantId, year, month, targetRevenue } });
  }

  await logActivity(session, "Objectif mensuel défini", "MonthlyTarget", consultantId ?? "global");
  revalidatePath("/admin/objectifs");
  revalidatePath("/admin/comptabilite");
  if (consultantId) revalidatePath(`/admin/consultants/${consultantId}`);
  revalidatePath("/admin");
}
