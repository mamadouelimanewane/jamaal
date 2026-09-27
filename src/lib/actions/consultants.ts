"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "./auth-guard";

function consultantDataFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    active: formData.get("active") === "on",
  };
}

export async function createConsultant(formData: FormData) {
  await requireStaff();
  await prisma.consultant.create({ data: consultantDataFromForm(formData) });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

export async function updateConsultant(id: string, formData: FormData) {
  await requireStaff();
  await prisma.consultant.update({ where: { id }, data: consultantDataFromForm(formData) });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

export async function deleteConsultant(id: string) {
  await requireStaff();
  await prisma.consultant.delete({ where: { id } });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
}
