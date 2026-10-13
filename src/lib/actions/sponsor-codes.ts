"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeSponsorCode } from "@/lib/sponsor-codes";
import { logActivity } from "@/lib/activity-log";
import { requireAdmin } from "./auth-guard";

const back = (msg: string, ok = false) => redirect(`/admin/candidatures?${ok ? "ok" : "erreur"}=${encodeURIComponent(msg)}#codes`);

/** Admin : créer un code de parrainage rattaché à un parrain (revendeur actif). */
export async function createSponsorCode(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const code = normalizeSponsorCode(String(formData.get("code") ?? ""));
  const consultantId = String(formData.get("consultantId") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 120) || null;
  if (!/^[a-z0-9-]{2,48}$/.test(code)) back("Code invalide : 2 à 48 lettres, chiffres ou tirets, sans espace.");
  const sponsor = await prisma.consultant.findFirst({ where: { id: consultantId, active: true }, select: { name: true } });
  if (!sponsor) back("Choisissez un parrain actif.");
  if (await prisma.consultant.findFirst({ where: { slug: code }, select: { id: true } })) back(`« ${code} » est déjà le code personnel d'un revendeur.`);
  if (await prisma.sponsorCode.findUnique({ where: { code }, select: { id: true } })) back(`Le code « ${code} » existe déjà.`);
  await prisma.sponsorCode.create({ data: { code, consultantId, label, createdBy: session.user?.id ?? null } });
  await logActivity(session, `Code de parrainage créé : ${code} (parrain ${sponsor!.name})`, "SponsorCode", code);
  revalidatePath("/admin/candidatures");
  back(`Code « ${code} » créé : les candidats qui le saisissent seront rattachés à ${sponsor!.name}.`, true);
}

export async function toggleSponsorCode(id: string): Promise<void> {
  await requireAdmin();
  const c = await prisma.sponsorCode.findUnique({ where: { id }, select: { active: true } });
  if (c) await prisma.sponsorCode.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/candidatures");
}

export async function deleteSponsorCode(id: string): Promise<void> {
  await requireAdmin();
  await prisma.sponsorCode.deleteMany({ where: { id } });
  revalidatePath("/admin/candidatures");
}
