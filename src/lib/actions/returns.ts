"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import type { ReturnStatus } from "@prisma/client";

export async function createReturn(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0) || 0;
  if (!orderId || !reason || amount <= 0) throw new Error("Commande, motif et montant sont requis");

  await prisma.return.create({ data: { orderId, reason, amount } });
  revalidatePath("/admin/retours");
  revalidatePath("/admin/comptabilite");
  redirect("/admin/retours");
}

export async function updateReturnStatus(id: string, status: ReturnStatus) {
  await requireAdmin();
  await prisma.return.update({
    where: { id },
    data: { status, processedAt: status === "EN_ATTENTE" ? null : new Date() },
  });
  revalidatePath("/admin/retours");
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin/statistiques");
}

export async function deleteReturn(id: string) {
  await requireAdmin();
  await prisma.return.delete({ where: { id } });
  revalidatePath("/admin/retours");
  revalidatePath("/admin/comptabilite");
}
