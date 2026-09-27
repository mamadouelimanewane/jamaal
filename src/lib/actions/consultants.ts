"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

function consultantDataFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    active: formData.get("active") === "on",
    sponsorId: String(formData.get("sponsorId") ?? "") || null,
  };
}

export async function createConsultant(formData: FormData) {
  await requireAdmin();
  await prisma.consultant.create({ data: consultantDataFromForm(formData) });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

export async function updateConsultant(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.consultant.update({ where: { id }, data: consultantDataFromForm(formData) });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

export async function deleteConsultant(id: string) {
  await requireAdmin();
  await prisma.consultant.delete({ where: { id } });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
}
