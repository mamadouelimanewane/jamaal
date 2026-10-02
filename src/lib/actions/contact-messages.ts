"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { requireAdmin } from "./auth-guard";

export type ContactState = { ok: boolean; error?: string };

const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(100),
  email: z.string().trim().toLowerCase().email("E-mail invalide.").max(254),
  message: z.string().trim().min(5, "Votre message est trop court.").max(2000, "Message trop long (2000 caractères maximum)."),
});

/** Formulaire de contact public : enregistre le message et prévient les admins. */
export async function submitContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot : un robot remplit ce champ caché, on fait semblant d'accepter.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const h = await headers();
  const limited = rateLimit(`contact:${clientIpFromHeaders(h)}`, { limit: 3, windowMs: 10 * 60_000 });
  if (!limited.ok) return { ok: false, error: `Trop de messages. Réessayez dans ${limited.retryAfterSec} s.` };

  const parsed = contactSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await prisma.contactMessage.create({ data: parsed.data });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: "Nouveau message de contact",
        message: `${parsed.data.name} : ${parsed.data.message.slice(0, 80)}`,
      })),
    });
  }
  revalidatePath("/admin/messages");
  return { ok: true };
}

export async function setContactMessageRead(id: string, read: boolean) {
  await requireAdmin();
  await prisma.contactMessage.update({ where: { id }, data: { read } });
  revalidatePath("/admin/messages");
}

export async function deleteContactMessage(id: string) {
  await requireAdmin();
  await prisma.contactMessage.delete({ where: { id } });
  revalidatePath("/admin/messages");
}
