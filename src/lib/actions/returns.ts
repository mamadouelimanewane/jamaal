"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import type { ReturnStatus } from "@prisma/client";

async function createReturnImpl(formData: FormData) {
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

async function updateReturnStatusImpl(id: string, status: ReturnStatus) {
  await requireAdmin();
  await prisma.return.update({
    where: { id },
    data: { status, processedAt: status === "EN_ATTENTE" ? null : new Date() },
  });
  revalidatePath("/admin/retours");
  revalidatePath("/admin/comptabilite");
  revalidatePath("/admin/statistiques");
}

async function deleteReturnImpl(id: string) {
  await requireAdmin();
  await prisma.return.delete({ where: { id } });
  revalidatePath("/admin/retours");
  revalidatePath("/admin/comptabilite");
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function createReturn(formData: FormData): Promise<void> {
  try {
    await createReturnImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/retours");
  }
}

export async function updateReturnStatus(id: string, status: ReturnStatus): Promise<void> {
  try {
    await updateReturnStatusImpl(id, status);
  } catch (e) {
    await backWithError(e, "/admin/retours");
  }
}

export async function deleteReturn(id: string): Promise<void> {
  try {
    await deleteReturnImpl(id);
  } catch (e) {
    await backWithError(e, "/admin/retours");
  }
}
