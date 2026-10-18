"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import { sendWhatsApp } from "@/lib/whatsapp";
import { parseAudience, runCampaign } from "@/lib/whatsapp/campaigns";
import { requireAdmin } from "./auth-guard";

export type InboxState = { ok: boolean; message?: string };

const PAUSE_MS = 2 * 3_600_000;

/** Réponse d'un conseiller depuis la boîte de réception : l'assistant se met en pause 2 h. */
export async function replyToThread(_prev: InboxState, formData: FormData): Promise<InboxState> {
  await requireAdmin("whatsapp");
  const phone = canonicalizePhone(String(formData.get("phone") ?? ""));
  const text = String(formData.get("text") ?? "").trim().slice(0, 1500);
  if (phone.length < 8) return { ok: false, message: "Numéro invalide." };
  if (!text) return { ok: false, message: "Écrivez un message." };
  // Texte libre uniquement si le client a écrit dans les 24 h ; sinon le modèle validé est utilisé.
  const recent = await prisma.whatsAppMessage.findFirst({ where: { toNumber: phone, direction: "IN", createdAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { id: true } });
  const r = await sendWhatsApp({ to: phone, text, kind: "conseiller", free: !!recent });
  await prisma.whatsAppThread.upsert({
    where: { phone },
    create: { phone, botPausedUntil: new Date(Date.now() + PAUSE_MS), lastReadAt: new Date() },
    update: { botPausedUntil: new Date(Date.now() + PAUSE_MS), lastReadAt: new Date() },
  });
  revalidatePath("/admin/whatsapp/conversations");
  if (r.status === "ECHEC") return { ok: false, message: `Échec : ${r.error ?? "erreur inconnue"}` };
  return { ok: true, message: r.status === "SIMULE" ? "Enregistré (mode simulation : WhatsApp non configuré)." : "Envoyé. L'assistant est en pause 2 h sur cette conversation." };
}

/** Met l'assistant en pause (heures > 0) ou le relance (0) sur une conversation. */
export async function setThreadBot(phone: string, hours: number) {
  await requireAdmin("whatsapp");
  const p = canonicalizePhone(phone);
  const until = hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 30) * 3_600_000) : null;
  await prisma.whatsAppThread.upsert({ where: { phone: p }, create: { phone: p, botPausedUntil: until }, update: { botPausedUntil: until } });
  revalidatePath("/admin/whatsapp/conversations");
}

export async function createCampaign(formData: FormData) {
  const session = await requireAdmin("whatsapp");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  if (!title || body.length < 5) redirect("/admin/whatsapp/campagnes?erreur=" + encodeURIComponent("Titre et message requis."));
  const audience = parseAudience({
    target: formData.get("target"),
    inactiveDays: formData.get("inactiveDays"),
    category: formData.get("category"),
    consultantId: formData.get("consultantId"),
    cta: { label: formData.get("ctaLabel"), url: formData.get("ctaUrl") },
  });
  const c = await prisma.whatsAppCampaign.create({ data: { title, body, audience: JSON.parse(JSON.stringify(audience)), createdBy: session.user?.id ?? null } });
  if (formData.get("send") === "1") await runCampaign(c.id);
  revalidatePath("/admin/whatsapp/campagnes");
  redirect(`/admin/whatsapp/campagnes?c=${c.id}`);
}

export async function continueCampaign(id: string) {
  await requireAdmin("whatsapp");
  await runCampaign(id);
  revalidatePath("/admin/whatsapp/campagnes");
}
