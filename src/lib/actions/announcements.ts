"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { requireAdmin } from "./auth-guard";

export type AnnouncementState = { ok: boolean; error?: string };

const schema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long."),
  body: z.string().trim().min(5, "Message trop court.").max(3000, "Message trop long."),
});

/** Publie une annonce visible par tous les consultants, les prévient par notification et l'envoie sur WhatsApp via l'API Cloud (Jamaal Luxury). */
export async function createAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  await requireAdmin("marketing");
  const parsed = schema.safeParse({ title: formData.get("title") ?? "", body: formData.get("body") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await prisma.announcement.create({ data: { ...parsed.data, pinned: formData.get("pinned") === "on" } });

  const [resellers, activeConsultants] = await Promise.all([
    prisma.user.findMany({ where: { role: "CONSULTANT" }, select: { id: true } }),
    prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, whatsapp: true } }),
  ]);

  if (resellers.length) {
    await prisma.notification.createMany({
      data: resellers.map((u) => ({ userId: u.id, title: "Nouvelle annonce JAMAAL", message: parsed.data.title })),
    });
  }

  // Envoi automatique de l'annonce aux consultants actifs via l'API Cloud WhatsApp de JAMAAL Luxury
  const broadcastWhatsApp = async () => {
    const text = `📢 *Annonce JAMAAL Luxury — ${parsed.data.title}*\n\n${parsed.data.body}`;
    for (const c of activeConsultants) {
      if (!c.whatsapp) continue;
      await sendWhatsApp({
        to: c.whatsapp,
        text,
        kind: "reseller",
      }).catch(() => {});
    }
  };

  try {
    after(broadcastWhatsApp);
  } catch {
    void broadcastWhatsApp();
  }

  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
  return { ok: true };
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin("marketing");
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
}

export async function togglePinAnnouncement(id: string) {
  await requireAdmin("marketing");
  const a = await prisma.announcement.findUnique({ where: { id }, select: { pinned: true } });
  if (!a) return;
  await prisma.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
}
