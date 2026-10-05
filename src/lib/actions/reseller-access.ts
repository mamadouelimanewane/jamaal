"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { requireAdmin } from "./auth-guard";

export type AccessResult = { ok: boolean; error?: string; activationUrl?: string; created?: boolean };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const emailSchema = z.string().trim().toLowerCase().email("E-mail invalide.").max(254);

/**
 * Donne un accès de connexion à un revendeur existant (ou renouvelle son lien d'activation).
 * Aucun mot de passe n'est communiqué : le revendeur choisit le sien via un lien valable 7 jours.
 */
export async function createResellerAccess(consultantId: string, rawEmail?: string): Promise<AccessResult> {
  await requireAdmin();
  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    select: { id: true, name: true, email: true, user: { select: { id: true } } },
  });
  if (!consultant) return { ok: false, error: "Revendeur introuvable." };

  const token = randomBytes(32).toString("base64url");
  let userId = consultant.user?.id;
  let created = false;

  if (!userId) {
    const parsed = emailSchema.safeParse(rawEmail ?? consultant.email ?? "");
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "E-mail requis." };
    const email = parsed.data;
    const taken = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (taken) return { ok: false, error: "Un compte existe déjà avec cet e-mail." };

    // Mot de passe aléatoire inutilisable tant que le lien d'activation n'a pas été utilisé.
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const user = await prisma.user.create({
      data: { email, name: consultant.name, passwordHash, role: "CONSULTANT", consultantId: consultant.id },
    });
    if (!consultant.email) await prisma.consultant.update({ where: { id: consultant.id }, data: { email } });
    userId = user.id;
    created = true;
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) },
  });

  const siteUrl = await getSiteUrl();
  revalidatePath("/admin/consultants");
  return { ok: true, created, activationUrl: `${siteUrl}/admin/reset-password?token=${encodeURIComponent(token)}` };
}

export type LoginLinkResult = { ok: boolean; error?: string; loginUrl?: string };

/**
 * Lien de connexion directe (sans mot de passe) pour un revendeur qui a déjà un compte :
 * valable 24 h, à usage unique, destiné à être envoyé sur WhatsApp. Le jeton est stocké haché
 * avec le préfixe « login: » (voir src/lib/auth.ts, fournisseur « magic »).
 */
export async function createResellerLoginLink(consultantId: string): Promise<LoginLinkResult> {
  await requireAdmin();
  const consultant = await prisma.consultant.findUnique({ where: { id: consultantId }, select: { active: true, user: { select: { id: true } } } });
  if (!consultant?.user) return { ok: false, error: "Ce revendeur n'a pas encore de compte : créez d'abord son accès." };
  if (!consultant.active) return { ok: false, error: "Ce revendeur est inactif." };

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: createHash("sha256").update(`login:${token}`).digest("hex"),
      userId: consultant.user.id,
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    },
  });
  const siteUrl = await getSiteUrl();
  return { ok: true, loginUrl: `${siteUrl}/admin/acces?token=${encodeURIComponent(token)}` };
}
