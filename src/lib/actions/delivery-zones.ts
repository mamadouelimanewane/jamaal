"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

function zoneDataFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    fee: Number(formData.get("fee") ?? 0) || 0,
    active: formData.get("active") === "on",
  };
}

export async function createDeliveryZone(formData: FormData) {
  const session = await requireAdmin();
  const zone = await prisma.deliveryZone.create({ data: zoneDataFromForm(formData) });
  await logActivity(session, "Création zone de livraison", "DeliveryZone", zone.id);
  revalidatePath("/admin/zones-livraison");
  redirect("/admin/zones-livraison");
}

export async function updateDeliveryZone(id: string, formData: FormData) {
  const session = await requireAdmin();
  await prisma.deliveryZone.update({ where: { id }, data: zoneDataFromForm(formData) });
  await logActivity(session, "Modification zone de livraison", "DeliveryZone", id);
  revalidatePath("/admin/zones-livraison");
  redirect("/admin/zones-livraison");
}

export async function deleteDeliveryZone(id: string) {
  const session = await requireAdmin();
  await prisma.deliveryZone.delete({ where: { id } });
  await logActivity(session, "Suppression zone de livraison", "DeliveryZone", id);
  revalidatePath("/admin/zones-livraison");
}
