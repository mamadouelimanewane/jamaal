"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

export async function updateCustomerNotes(id: string, formData: FormData) {
  await requireAdmin();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  await prisma.customer.update({ where: { id }, data: { notes } });
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
}

