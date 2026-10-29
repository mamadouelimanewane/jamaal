"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { accountsByPhone } from "@/lib/staff-accounts";
import { phoneTail } from "@/lib/phone-match";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { LIVREUR_ACTIVE, LIVREUR_PENDING, parseLivreurSignup, vehicleLabel } from "@/lib/livreur-signup";
import { requireAdmin } from "./auth-guard";

export type SignupState = { ok: boolean; error?: string; field?: string; name?: string; values?: Record<string, string>; n?: number } | null;

/** Valeurs renvoyées au formulaire après une erreur (jamais les mots de passe). */
const KEEP = ["name", "phone", "zone", "vehicle", "walletProvider", "walletNumber", "idNumber"] as const;
const keepValues = (f: FormData) => Object.fromEntries(KEEP.map((k) => [k, String(f.get(k) ?? "").slice(0, 120)]));

/**
 * Inscription depuis l'application JAMAAL Livreur : fiche livreur + compte créés INACTIFS, à valider par
 * l'administrateur (Livraison › Livreurs). Le livreur ne peut pas se connecter avant la validation.
 */
export async function registerLivreur(prev: SignupState, formData: FormData): Promise<SignupState> {
  const fail = (error: string, field?: string): SignupState => ({ ok: false, error, field, values: keepValues(formData), n: (prev?.n ?? 0) + 1 });
  if (String(formData.get("website") ?? "")) return { ok: true, name: "" }; // piège à robots
  const ip = clientIpFromHeaders(await headers());
  const limited = await rateLimit(`livreur-signup:${ip}`, { limit: 5, windowMs: 3_600_000 });
  if (!limited.ok) return fail("Trop d'inscriptions depuis ce téléphone. Réessayez dans une heure ou écrivez à l'équipe JAMAAL.");

  const check = parseLivreurSignup(formData);
  if (!check.ok) return fail(check.error, check.field);
  const d = check.data;

  const tail = phoneTail(d.phone);
  const [accounts, sameLivreur] = await Promise.all([
    accountsByPhone(d.phone),
    prisma.$queryRaw<{ status: string }[]>`SELECT status FROM "Livreur" WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`,
  ]);
  if (sameLivreur[0]?.status === LIVREUR_PENDING) return fail("Une inscription avec ce numéro est déjà en cours de validation. Vous serez prévenu sur WhatsApp.", "phone");
  if (accounts.length || sameLivreur.length) return fail("Ce numéro a déjà un compte JAMAAL : connectez-vous avec « J'ai déjà un compte ».", "phone");

  const passwordHash = await bcrypt.hash(d.password, 10);
  try {
    await prisma.$transaction(async (tx) => {
      const l = await tx.livreur.create({
        data: { name: d.name, phone: d.phone, active: false, status: LIVREUR_PENDING, vehicle: d.vehicle, zone: d.zone, idNumber: d.idNumber, walletProvider: d.walletProvider, walletNumber: d.walletNumber },
      });
      await tx.user.create({ data: { name: d.name, phone: d.phone, passwordHash, role: Role.LIVREUR, active: false, livreurId: l.id } });
    });
  } catch {
    return fail("Ce numéro a déjà un compte JAMAAL : connectez-vous avec « J'ai déjà un compte ».", "phone");
  }

  const msg = `${d.name} (${d.phone}) · ${vehicleLabel(d.vehicle)} · ${d.zone}`;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true }, take: 30 });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title: "Nouveau livreur à valider 🛵", message: `${msg}. À valider dans Livraison › Livreurs.` })) }).catch(() => {});
  notifyTeamWhatsApp(`🛵 Nouvelle inscription livreur à valider : ${msg}.`);
  revalidatePath("/admin/livreurs");
  return { ok: true, name: d.name.split(" ")[0] };
}

/** Validation par l'administrateur : la fiche devient active et le livreur peut se connecter. */
export async function approveLivreur(id: string) {
  await requireAdmin("livraison");
  const l = await prisma.livreur.findUnique({ where: { id }, select: { id: true } });
  if (!l) redirect("/admin/livreurs");
  await prisma.$transaction([
    prisma.livreur.update({ where: { id }, data: { active: true, status: LIVREUR_ACTIVE } }),
    prisma.user.updateMany({ where: { livreurId: id }, data: { active: true } }),
  ]);
  revalidatePath("/admin/livreurs");
  redirect(`/admin/livreurs?valide=${encodeURIComponent(id)}`);
}

/** Refus : l'inscription est supprimée (le numéro pourra se réinscrire plus tard). */
export async function rejectLivreur(id: string) {
  await requireAdmin("livraison");
  const l = await prisma.livreur.findUnique({ where: { id }, select: { status: true, _count: { select: { orders: true } } } });
  if (!l || l.status !== LIVREUR_PENDING || l._count.orders) redirect("/admin/livreurs");
  await prisma.$transaction([prisma.user.deleteMany({ where: { livreurId: id } }), prisma.livreur.delete({ where: { id } })]);
  revalidatePath("/admin/livreurs");
  redirect("/admin/livreurs?refuse=1");
}
