"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { allShopsStats } from "@/lib/shop/shop-stats-store";
import { parsePeriod } from "@/lib/shop/shop-stats";
import { getSiteUrl } from "@/lib/site-url";
import { KINDS, renderOutreach, type OutreachKind } from "@/lib/reseller-outreach";
import { logActivity } from "@/lib/activity-log";

export type AnnouncementState = { ok: boolean; error?: string };

const schema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long."),
  body: z.string().trim().min(5, "Message trop court.").max(3000, "Message trop long."),
});

/** Publie une annonce visible par tous les consultants, et les prévient par notification. */
export async function createAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  await requireAdmin("marketing");
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

export type TargetedState = {
  ok: boolean;
  error?: string;
  /** Destinataires avec leur message personnalisé (pour l'envoyer aussi sur WhatsApp). */
  sent?: { id: string; name: string; whatsapp: string | null; text: string }[];
};

/**
 * Annonce ciblée : envoyée seulement aux revendeurs choisis (depuis Statistiques des boutiques), avec un texte
 * personnalisé pour chacun ({prenom}, {ventes}, {visiteurs}…, calculés ici sur la période choisie).
 */
export async function sendTargetedAnnouncement(_prev: TargetedState, fd: FormData): Promise<TargetedState> {
  const session = await requireAdmin("revendeurs");
  const parsed = schema.safeParse({ title: fd.get("title") ?? "", body: fd.get("body") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  let ids: string[] = [];
  try {
    ids = (JSON.parse(String(fd.get("ids") ?? "[]")) as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 2000);
  } catch {
    ids = [];
  }
  if (!ids.length) return { ok: false, error: "Sélectionnez au moins un revendeur." };
  const days = parsePeriod(String(fd.get("days") ?? ""));
  const kindRaw = String(fd.get("kind") ?? "INFO");
  const kind: OutreachKind = kindRaw in KINDS ? (kindRaw as OutreachKind) : "INFO";

  const [{ rows }, origin] = await Promise.all([allShopsStats(days), getSiteUrl()]);
  const chosen = rows.filter((r) => ids.includes(r.id));
  if (!chosen.length) return { ok: false, error: "Aucun des revendeurs sélectionnés n'est actif." };

  const personalized: Record<string, { title: string; body: string }> = {};
  for (const r of chosen) {
    personalized[r.id] = { title: renderOutreach(parsed.data.title, r, days, origin).slice(0, 160), body: renderOutreach(parsed.data.body, r, days, origin).slice(0, 4000) };
  }
  await prisma.announcement.create({
    data: { title: parsed.data.title, body: parsed.data.body, pinned: fd.get("pinned") === "on", consultantIds: chosen.map((r) => r.id), personalized, kind, statsDays: days },
  });
  const users = await prisma.user.findMany({ where: { consultantId: { in: chosen.map((r) => r.id) } }, select: { id: true, consultantId: true } });
  if (users.length) {
    await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, title: `${KINDS[kind]} JAMAAL`, message: personalized[u.consultantId!]?.title ?? parsed.data.title })),
    });
  }
  await logActivity(session, `Annonce ciblée (${KINDS[kind].toLowerCase()}) à ${chosen.length} revendeur(s) : ${parsed.data.title}`, "Announcement");
  revalidatePath("/admin/annonces");
  revalidatePath("/admin/ma-communication");
  return {
    ok: true,
    sent: chosen.map((r) => ({ id: r.id, name: r.name, whatsapp: r.whatsapp, text: `*${personalized[r.id].title}*\n\n${personalized[r.id].body}` })),
  };
}
