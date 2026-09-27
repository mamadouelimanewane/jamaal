"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";

function livreurDataFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    active: formData.get("active") === "on",
  };
}

export async function createLivreur(formData: FormData) {
  await requireAdmin();
  await prisma.livreur.create({ data: livreurDataFromForm(formData) });
  revalidatePath("/admin/livreurs");
  redirect("/admin/livreurs");
}

export async function updateLivreur(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.livreur.update({ where: { id }, data: livreurDataFromForm(formData) });
  revalidatePath("/admin/livreurs");
  redirect("/admin/livreurs");
}

export async function deleteLivreur(id: string) {
  await requireAdmin();
  await prisma.livreur.delete({ where: { id } });
  revalidatePath("/admin/livreurs");
}

export async function shareLivreurPosition(lat: number, lng: number) {
  const { livreur } = await requireLivreurProfile();
  await prisma.livreur.update({
    where: { id: livreur.id },
    data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
  });
  revalidatePath("/admin/livreurs");
  revalidatePath("/admin/mes-livraisons");
}
