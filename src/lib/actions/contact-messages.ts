"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { canonicalizePhone } from "@/lib/phone";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { routeInboundClientMessage } from "@/lib/whatsapp/kwingo-bridge";
import { requireAdmin } from "./auth-guard";

export type ContactState = { ok: boolean; error?: string };

const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(100),
  email: z.string().trim().toLowerCase().email("E-mail invalide.").max(254),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(5, "Votre message est trop court.").max(2000, "Message trop long (2000 caractères maximum)."),
});

/** Formulaire de contact public : enregistre le message, l'ajoute à la Messagerie WhatsApp JAMAAL Luxury (API Cloud) et prévient l'équipe. */
export async function submitContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot : un robot remplit ce champ caché, on fait semblant d'accepter.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const h = await headers();
  const limited = await rateLimit(`contact:${clientIpFromHeaders(h)}`, { limit: 3, windowMs: 10 * 60_000 });
  if (!limited.ok) return { ok: false, error: `Trop de messages. Réessayez dans ${limited.retryAfterSec} s.` };

  const parsed = contactSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ? String(formData.get("phone")) : undefined,
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const rawPhone = parsed.data.phone ? canonicalizePhone(parsed.data.phone) : "";
  const formattedBody = rawPhone
    ? `[Formulaire Contact · ${parsed.data.email} · +${rawPhone}]\n${parsed.data.message}`
    : `[Formulaire Contact · ${parsed.data.email}]\n${parsed.data.message}`;

  await prisma.contactMessage.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      message: rawPhone ? `[WhatsApp: +${rawPhone}] ${parsed.data.message}` : parsed.data.message,
    },
  });

  // Acheminement dans la Messagerie WhatsApp JAMAAL Luxury (+221 71 180 09 09 / API Cloud) avec routage dynamique consultant
  const threadPhone = rawPhone.length >= 8 ? rawPhone : WHATSAPP_CONTACTS[0].number;
  await prisma.whatsAppMessage
    .create({
      data: {
        direction: "IN",
        toNumber: threadPhone,
        kind: "inbound",
        body: formattedBody.slice(0, 1500),
        status: "RECU",
      },
    })
    .catch(() => {});

  await routeInboundClientMessage({
    phone: threadPhone,
    profileName: `${parsed.data.name} (Contact site)`,
    text: parsed.data.message,
  }).catch(() => {});

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
  notifyTeamWhatsApp(
    `📩 Message de contact JAMAAL Luxury de ${parsed.data.name} (${parsed.data.email}${rawPhone ? ` · +${rawPhone}` : ""}) : ${parsed.data.message.slice(0, 220)}`,
  );
  revalidatePath("/admin/messages");
  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/conversations");
  revalidatePath("/admin/mon-inbox");
  return { ok: true };
}

export async function setContactMessageRead(id: string, read: boolean) {
  await requireAdmin("clients");
  await prisma.contactMessage.update({ where: { id }, data: { read } });
  revalidatePath("/admin/messages");
}

export async function deleteContactMessage(id: string) {
  await requireAdmin("clients");
  await prisma.contactMessage.delete({ where: { id } });
  revalidatePath("/admin/messages");
}
