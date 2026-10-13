"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { phoneTail } from "@/lib/phone-match";
import { canonicalizePhone, phoneLookupVariants } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);

export async function requestPasswordReset(formData: FormData) {
  const requestHeaders = await headers();
  const limited = await rateLimit(`password-reset:${clientIpFromHeaders(requestHeaders)}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!limited.ok) redirect("/admin/forgot-password?sent=1");

  const identifier = String(formData.get("email") ?? "").trim();
  // Numéro de téléphone : le lien part sur le WhatsApp du compte (jamais vers un autre numéro).
  if (!identifier.includes("@") && identifier.replace(/\D/g, "").length >= 9) {
    await sendResetByWhatsApp(identifier);
    redirect("/admin/forgot-password?sent=wa");
  }
  const email = identifier.toLowerCase();
  const apiKey = process.env.RESEND_API_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const from = process.env.EMAIL_FROM;
  if (email && email.length <= 254 && apiKey && siteUrl && from) {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, email: true, name: true } });
    if (user) {
      const recent = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } }, select: { id: true } });
      if (!recent) {
        const token = randomBytes(32).toString("base64url");
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await prisma.passwordResetToken.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
        const url = `${siteUrl.replace(/\/$/, "")}/admin/reset-password?token=${encodeURIComponent(token)}`;
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from,
              to: [user.email],
              subject: "Réinitialiser votre mot de passe JAMAAL",
              html: `<p>Bonjour ${escapeHtml(user.name)},</p><p>Utilisez le lien sécurisé ci-dessous dans l’heure :</p><p><a href="${url}">Réinitialiser mon mot de passe</a></p><p>Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>`,
            }),
          });
          if (!response.ok) console.error("Password reset email delivery failed", response.status);
        } catch (error) {
          console.error("Password reset email delivery failed", error);
        }
      }
    }
  } else {
    console.error("Password reset email unavailable: configure RESEND_API_KEY, EMAIL_FROM and NEXT_PUBLIC_SITE_URL.");
  }
  redirect("/admin/forgot-password?sent=1");
}

/** Compte (avec son numéro WhatsApp) correspondant à un téléphone : compte, revendeur ou livreur. */
async function userByPhone(raw: string): Promise<{ id: string; name: string; whatsapp: string } | null> {
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

async function sendResetByWhatsApp(raw: string) {
  if (!whatsappConfig().active) return;
  const user = await userByPhone(raw);
  if (!user) return;
  const recent = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } }, select: { id: true } });
  if (recent) return;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  const url = `${(await getSiteUrl()).replace(/\/$/, "")}/admin/reset-password?token=${encodeURIComponent(token)}`;
  await sendWhatsApp({
    to: canonicalizePhone(user.whatsapp),
    kind: "reseller",
    text: `Bonjour ${user.name.split(/\s+/)[0]}, voici votre lien JAMAAL pour choisir un nouveau mot de passe (valable 24 h). Si vous n'avez rien demandé, ignorez ce message.`,
    cta: { label: "Choisir mon mot de passe", url },
  });
}

/** État d'un lien (sans le consommer) : pour prévenir avant que la personne tape son mot de passe. */
export async function resetLinkState(token: string): Promise<"ok" | "invalid"> {
  if (!token) return "invalid";
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { expiresAt: true } });
  return record && record.expiresAt > new Date() ? "ok" : "invalid";
}

export async function completePasswordReset(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8 || password.length > 128 || password !== confirmation) {
    redirect(`/admin/reset-password?token=${encodeURIComponent(token)}&error=1`);
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { email: true, phone: true, name: true } } } });
  if (!record || record.expiresAt <= new Date()) redirect("/admin/reset-password?error=expired");
  const passwordHash = await bcrypt.hash(password, 12);
  // L'identifiant utilisé à la prochaine connexion peut être l'e-mail ou le téléphone : on
  // efface le compteur de tentatives pour les deux, selon ce que le compte possède.
  const identifiants = [record.user.email?.toLowerCase(), record.user.phone].filter((v): v is string => !!v);
  const completed = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.deleteMany({ where: { id: record.id, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    if (identifiants.length) await tx.loginAttempt.deleteMany({ where: { identifiant: { in: identifiants } } });
    await tx.activityLog.create({ data: { userId: record.userId, userName: record.user.name, action: "Réinitialisation du mot de passe", entity: "User", entityId: record.userId } });
    return true;
  });
  if (!completed) redirect("/admin/reset-password?error=expired");
  redirect("/admin/login?reset=1");
}