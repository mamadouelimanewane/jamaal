/**
 * Mot de passe oublié (revendeurs, livreurs) : retrouver le compte d'un numéro WhatsApp et créer un
 * lien à usage unique. Fichier serveur (jamais une action appelable depuis le navigateur).
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { phoneTail } from "@/lib/phone-match";
import { phoneLookupVariants } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Compte (avec son numéro WhatsApp) correspondant à un téléphone : compte, revendeur ou livreur. */
export async function userByPhone(raw: string): Promise<{ id: string; name: string; whatsapp: string } | null> {
  const tail = phoneTail(raw);
  if (!tail) return null;
  const direct = await prisma.user.findFirst({ where: { phone: { in: phoneLookupVariants(raw) } }, select: { id: true, name: true, phone: true, role: true } });
  if (direct?.phone && direct.role !== "CLIENT") return { id: direct.id, name: direct.name, whatsapp: direct.phone };
  const viaConsultant = await prisma.$queryRaw<{ id: string; name: string; whatsapp: string }[]>`
    SELECT u.id, u.name, c.whatsapp FROM "Consultant" c JOIN "User" u ON u."consultantId" = c.id
    WHERE right(regexp_replace(c.whatsapp, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`;
  if (viaConsultant[0]) return viaConsultant[0];
  const viaLivreur = await prisma.$queryRaw<{ id: string; name: string; whatsapp: string }[]>`
    SELECT u.id, u.name, l.phone AS whatsapp FROM "Livreur" l JOIN "User" u ON u."livreurId" = l.id
    WHERE right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`;
  return viaLivreur[0] ?? null;
}


/** Lien « choisir mon mot de passe » (null si un lien vient d'être créé : 2 minutes entre deux demandes). */
export async function createResetLink(userId: string, hours: number): Promise<string | null> {
  const recent = await prisma.passwordResetToken.findFirst({ where: { userId, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } }, select: { id: true } });
  if (recent) return null;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + hours * 3600_000) } });
  return `${(await getSiteUrl()).replace(/\/$/, "")}/admin/reset-password?token=${encodeURIComponent(token)}`;
}

/** Prévient les administrateurs (notification dans le back-office), au plus une fois par heure et par compte. */
export async function notifyAdminsOfResetRequest(user: { id: string; name: string; whatsapp: string }) {
  try {
    const key = `mdp-oublie:${user.id}:${new Date().toISOString().slice(0, 13)}`;
    await prisma.automationSent.create({ data: { key } });
  } catch {
    return; // déjà signalé cette heure-ci
  }
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title: `Mot de passe oublié : ${user.name}`,
      message: `${user.name} (${user.whatsapp}) a demandé un nouveau mot de passe. S'il ne reçoit pas le lien sur WhatsApp : Utilisateurs › ${user.name} › « Générer un lien d'accès » puis « Envoyer par WhatsApp ».`,
    })),
  });
}

/** Message « mot de passe » reçu sur WhatsApp ? (« mot de passe », « mdp », « mot de passe oublié »…). Pur, testé. */
export function isPasswordRequest(text: string): boolean {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return /^(j ai oublie (mon )?)?(mot de passe|mdp|password|nouveau mot de passe|reinitialiser (mon )?mot de passe)( oublie)?$/.test(t);
}
