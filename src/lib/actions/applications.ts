"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { applicationSchema } from "@/lib/validations/application";
import { uniqueConsultantSlug } from "@/lib/unique-slug";
import { getSiteUrl } from "@/lib/site-url";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { requireAdmin } from "./auth-guard";
import { getBusinessModel } from "@/lib/business-model-store";
import { sponsorCapacity, sponsorRefusal } from "@/lib/network";

export type ApplicationState = {
  ok: boolean;
  error?: string;
  /** Résumé renvoyé au navigateur pour préremplir le message WhatsApp envoyé à l'équipe. */
  applicant?: { name: string; city: string; phone: string };
};

/** Candidature publique (page /devenir-consultant). */
export async function submitApplication(_prev: ApplicationState, formData: FormData): Promise<ApplicationState> {
  // Honeypot : un robot remplit ce champ caché, on fait semblant d'accepter.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const h = await headers();
  const limited = await rateLimit(`apply:${clientIpFromHeaders(h)}`, { limit: 3, windowMs: 10 * 60_000 });
  if (!limited.ok) return { ok: false, error: `Trop de tentatives. Réessayez dans ${limited.retryAfterSec} s.` };

  const parsed = applicationSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    city: formData.get("city") ?? "",
    country: formData.get("country") || "Sénégal",
    experience: formData.get("experience") ?? "",
    motivation: formData.get("motivation") ?? "",
    sponsorCode: formData.get("sponsorCode") ?? "",
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const d = parsed.data;

  // Parrainage obligatoire : le code doit être celui d'un membre actif qui a encore de la place.
  const sponsorCode = d.sponsorCode.toLowerCase();
  const sponsor = await prisma.consultant.findFirst({ where: { slug: sponsorCode, active: true }, select: { id: true, name: true } });
  if (!sponsor) return { ok: false, error: "Ce code de parrainage n'existe pas ou n'est plus actif. Vérifiez-le auprès de votre parrain." };
  const { maxDirectRecruits } = await getBusinessModel();
  const capacity = await sponsorCapacity(sponsor.id, maxDirectRecruits);
  if (!capacity.ok) {
    return { ok: false, error: sponsorRefusal(sponsor.name, capacity) };
  }

  // Pas de doublon en attente pour le même e-mail.
  const pending = await prisma.consultantApplication.findFirst({
    where: { email: d.email, status: "NOUVELLE" },
    select: { id: true },
  });
  if (pending) return { ok: true, applicant: { name: d.name, city: d.city, phone: d.phone } };

  await prisma.consultantApplication.create({
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone,
      city: d.city,
      country: d.country,
      experience: d.experience || null,
      motivation: d.motivation || null,
      sponsorCode,
    },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: "Nouvelle candidature consultant",
        message: `${d.name} (${d.city}) souhaite devenir consultant·e.`,
      })),
    });
  }
  notifyTeamWhatsApp(`Nouvelle candidature consultant : ${d.name} (${d.city}), WhatsApp ${d.phone}. À traiter dans Admin > Candidatures.`);
  revalidatePath("/admin/candidatures");
  return { ok: true, applicant: { name: d.name, city: d.city, phone: d.phone } };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type ApproveResult = { ok: boolean; error?: string; activationUrl?: string; emailed?: boolean };

/**
 * Accepte une candidature : crée le profil consultant (avec lien personnel /c/slug)
 * et un compte de connexion. Le/la candidat·e choisit son mot de passe via un lien
 * d'activation valable 7 jours — aucun mot de passe n'est communiqué.
 */
export async function approveApplication(id: string): Promise<ApproveResult> {
  await requireAdmin();
  const app = await prisma.consultantApplication.findUnique({ where: { id } });
  if (!app) return { ok: false, error: "Candidature introuvable." };
  if (app.status !== "NOUVELLE") return { ok: false, error: "Candidature déjà traitée." };

  const email = app.email.toLowerCase();
  const exists = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (exists) return { ok: false, error: "Un compte existe déjà avec cet e-mail." };

  // Nouvelle vérification : le parrain a pu atteindre sa limite depuis la candidature.
  const sponsor = app.sponsorCode
    ? await prisma.consultant.findFirst({ where: { slug: app.sponsorCode, active: true }, select: { id: true, name: true } })
    : null;
  if (!sponsor) return { ok: false, error: "Pas de parrain actif pour cette candidature : rattachez-la à un membre (code de parrainage) avant de l'accepter." };
  const { maxDirectRecruits } = await getBusinessModel();
  const capacity = await sponsorCapacity(sponsor.id, maxDirectRecruits);
  if (!capacity.ok) return { ok: false, error: `${sponsorRefusal(sponsor.name, capacity)} Rattachez cette candidature à un autre membre.` };
  const slug = await uniqueConsultantSlug(app.name);
  const token = randomBytes(32).toString("base64url");
  // Mot de passe aléatoire inutilisable tant que le lien d'activation n'a pas été utilisé.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  await prisma.$transaction(async (tx) => {
    const consultant = await tx.consultant.create({
      data: { name: app.name, city: app.city, whatsapp: app.phone, email, active: true, slug, sponsorId: sponsor.id },
    });
    const user = await tx.user.create({
      data: { email, name: app.name, passwordHash, role: "CONSULTANT", consultantId: consultant.id },
    });
    await tx.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) },
    });
    await tx.consultantApplication.update({
      where: { id },
      data: { status: "ACCEPTEE", consultantId: consultant.id, processedAt: new Date() },
    });
  });

  // Action réservée aux admins : l'hôte de la requête est fiable (pas d'empoisonnement de lien).
  const siteUrl = await getSiteUrl();
  const activationUrl = `${siteUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;

  let emailed = false;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from && siteUrl) {
    try {
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Bienvenue chez JAMAAL — activez votre espace consultant",
          html: `<p>Bonjour ${esc(app.name)},</p><p>Votre candidature a été acceptée. Choisissez votre mot de passe (lien valable 7 jours) :</p><p><a href="${activationUrl}">Activer mon espace consultant</a></p><p>Votre lien de vente personnel : ${siteUrl}/c/${slug}</p>`,
        }),
      });
      emailed = res.ok;
    } catch (error) {
      console.error("Application approval email failed", error);
    }
  }

  // Pas de revalidation de /admin/candidatures ici : elle ferait disparaître la ligne (et le lien
  // d'activation affiché par le composant) avant que l'admin ait pu le copier.
  revalidatePath("/admin/consultants");
  return { ok: true, activationUrl, emailed };
}

export async function rejectApplication(id: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const res = await prisma.consultantApplication.updateMany({
    where: { id, status: "NOUVELLE" },
    data: { status: "REFUSEE", adminNote: note?.trim().slice(0, 300) || null, processedAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: "Candidature déjà traitée." };
  revalidatePath("/admin/candidatures");
  return { ok: true };
}
