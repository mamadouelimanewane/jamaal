"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

export async function createExpense(formData: FormData) {
  await requireAdmin();
  const dateVal = String(formData.get("date") ?? "");
  await prisma.expense.create({
    data: {
      label: String(formData.get("label") ?? "").trim(),
      amount: Number(formData.get("amount") ?? 0) || 0,
      category: String(formData.get("category") ?? "Autre"),
      date: dateVal ? new Date(dateVal) : new Date(),
    },
  });
  revalidatePath("/admin/comptabilite");
  redirect("/admin/comptabilite");
}

export async function deleteExpense(id: string) {
  await requireAdmin();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/admin/comptabilite");
}
