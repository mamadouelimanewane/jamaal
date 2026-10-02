"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

export type AnnouncementState = { ok: boolean; error?: string };

const schema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long."),
  body: z.string().trim().min(5, "Message trop court.").max(3000, "Message trop long."),
});

/** Publie une annonce visible par tous les revendeurs, et les prévient par notification. */
export async function createAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  await requireAdmin();
  const parsed = schema.safeParse({ title: formData.get("title") ?? "", body: formData.get("body") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await prisma.announcement.create({ data: { ...parsed.data, pinned: formData.get("pinned") === "on" } });

  const resellers = await prisma.user.findMany({ where: { role: "CONSULTANT" }, select: { id: true } });
  if (resellers.length) {
    await prisma.notification.createMany({
      data: resellers.map((u) => ({ userId: u.id, title: "Nouvelle annonce JAMAAL", message: parsed.data.title })),
    });
  }
  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
  return { ok: true };
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin();
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
}

export async function togglePinAnnouncement(id: string) {
  await requireAdmin();
  const a = await prisma.announcement.findUnique({ where: { id }, select: { pinned: true } });
  if (!a) return;
  await prisma.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
}
