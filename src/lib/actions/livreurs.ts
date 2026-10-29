"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { recordPosition } from "@/lib/livreur-tracking";

function livreurDataFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    active: formData.get("active") === "on",
  };
}

export async function createLivreur(formData: FormData) {
  await requireAdmin("livraison");
  await prisma.livreur.create({ data: livreurDataFromForm(formData) });
  revalidatePath("/admin/livreurs");
  redirect("/admin/livreurs");
}

export async function updateLivreur(id: string, formData: FormData) {
  await requireAdmin("livraison");
  await prisma.livreur.update({ where: { id }, data: livreurDataFromForm(formData) });
  revalidatePath("/admin/livreurs");
  redirect("/admin/livreurs");
}

export async function deleteLivreur(id: string) {
  await requireAdmin("livraison");
  await prisma.livreur.delete({ where: { id } });
  revalidatePath("/admin/livreurs");
}

export async function shareLivreurPosition(lat: number, lng: number) {
  const { livreur } = await requireLivreurProfile();
  await recordPosition(livreur.id, { lat, lng });
}
