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

/** Rattache une commande passée à une fiche client (déduplication par téléphone). */
export async function upsertCustomerFromOrder(input: {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}) {
  const phone = input.phone.trim();
  if (!phone) return null;
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: {
      name: input.name,
      email: input.email || undefined,
      address: input.address || undefined,
    },
    create: {
      name: input.name,
      phone,
      email: input.email || null,
      address: input.address || null,
    },
  });
  return customer.id;
}
