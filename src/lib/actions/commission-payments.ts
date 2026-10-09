"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

async function recordCommissionPaymentImpl(consultantId: string, formData: FormData) {
  const session = await requireAdmin();
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const periodLabel = String(formData.get("periodLabel") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (amount <= 0 || !periodLabel) throw new Error("Montant et période requis");

  const payment = await prisma.commissionPayment.create({
    data: { consultantId, amount, periodLabel, note },
  });
  await logActivity(session, "Paiement de commission enregistré", "CommissionPayment", payment.id);
  revalidatePath(`/admin/consultants/${consultantId}`);
  revalidatePath("/admin/consultants");
}

async function deleteCommissionPaymentImpl(id: string, consultantId: string) {
  const session = await requireAdmin();
  await prisma.commissionPayment.delete({ where: { id } });
  await logActivity(session, "Suppression paiement de commission", "CommissionPayment", id);
  revalidatePath(`/admin/consultants/${consultantId}`);
  revalidatePath("/admin/consultants");
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function recordCommissionPayment(consultantId: string, formData: FormData): Promise<void> {
  try {
    await recordCommissionPaymentImpl(consultantId, formData);
  } catch (e) {
    await backWithError(e, "/admin/consultants");
  }
}

export async function deleteCommissionPayment(id: string, consultantId: string): Promise<void> {
  try {
    await deleteCommissionPaymentImpl(id, consultantId);
  } catch (e) {
    await backWithError(e, "/admin/consultants");
  }
}
