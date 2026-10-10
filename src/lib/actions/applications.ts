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
import { logActivity } from "@/lib/activity-log";
import { getBusinessModel } from "@/lib/business-model-store";
import { sponsorCapacity, sponsorRefusal, TITLE_RANK } from "@/lib/network";
import { fillProtocol, pieceLabel } from "@/lib/protocol";
import { getProtocol, textHash } from "@/lib/protocol-store";

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
    address: formData.get("address") ?? "",
    idType: formData.get("idType") ?? "",
    idNumber: formData.get("idNumber") ?? "",
    acceptProtocol: formData.get("acceptProtocol") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const d = parsed.data;

  // Pièce d'identité (recto + verso) et signature du protocole.
  const front = await readIdPhoto(formData.get("idFront"), "recto");
  if (typeof front === "string") return { ok: false, error: front };
  const back = await readIdPhoto(formData.get("idBack"), "verso");
  if (typeof back === "string") return { ok: false, error: back };
  const signature = readSignature(formData.get("signature"));
  if (!signature) return { ok: false, error: "Signez le protocole dans le cadre prévu (au doigt ou à la souris)." };
  const protocol = await getProtocol();
  if (Number(formData.get("protocolVersion")) !== protocol.version) {
    return { ok: false, error: "Le protocole vient d'être mis à jour : rechargez la page, relisez-le et signez de nouveau." };
  }

  // Parrainage obligatoire : le code doit être celui d'un membre actif qui a encore de la place.
  const sponsorCode = d.sponsorCode.toLowerCase();
  const sponsor = await prisma.consultant.findFirst({ where: { slug: sponsorCode, active: true }, select: { id: true, name: true } });
  if (!sponsor) return { ok: false, error: "Ce code de parrainage n'existe pas ou n'est plus actif. Vérifiez-le auprès de votre parrain." };
  const capacity = await sponsorCapacity(sponsor.id, await getBusinessModel());
  if (!capacity.ok) {
    return { ok: false, error: sponsorRefusal(sponsor.name, capacity) };
  }

  // Pas de doublon en attente pour le même e-mail.
  const pending = await prisma.consultantApplication.findFirst({
    where: { email: d.email, status: "NOUVELLE" },
    select: { id: true },
  });
  if (pending) return { ok: true, applicant: { name: d.name, city: d.city, phone: d.phone } };

  const signedText = fillProtocol(protocol.text, { nom: d.name, piece: pieceLabel(d.idType, d.idNumber), adresse: d.address, telephone: d.phone, code_parrain: sponsorCode });
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
      address: d.address,
      idType: d.idType,
      idNumber: d.idNumber.toUpperCase(),
      idFront: front.bytes,
      idBack: back.bytes,
      idMime: front.mime,
      signature: {
        create: {
          version: protocol.version,
          text: signedText,
          textHash: textHash(signedText),
          signerName: d.name,
          idType: d.idType,
          idNumber: d.idNumber.toUpperCase(),
          address: d.address,
          phone: d.phone,
          image: signature,
          ip: clientIpFromHeaders(h),
          userAgent: (h.get("user-agent") ?? "").slice(0, 300) || null,
        },
      },
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

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Photo de pièce d'identité : image de 3 Mo au plus (compressée dans le navigateur). */
async function readIdPhoto(v: FormDataEntryValue | null, face: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string } | string> {
  if (!(v instanceof File) || v.size === 0) return `Ajoutez la photo ${face} de votre pièce d'identité.`;
  if (!PHOTO_TYPES.includes(v.type)) return `Photo ${face} : format accepté JPG, PNG ou WebP.`;
  if (v.size > 3 * 1024 * 1024) return `Photo ${face} trop lourde (3 Mo au plus).`;
  return { bytes: new Uint8Array(await v.arrayBuffer()), mime: v.type };
}

/** Signature dessinée : image PNG en data URL (400 Ko au plus). */
function readSignature(v: FormDataEntryValue | null): Uint8Array<ArrayBuffer> | null {
  const m = typeof v === "string" ? v.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 400 || buf.length > 400_000 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return new Uint8Array(buf);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type ApproveResult = { ok: boolean; error?: string; activationUrl?: string; emailed?: boolean };

/**
 * Accepte une candidature : crée le profil consultant (avec lien personnel /c/slug)
 * et un compte de connexion. Le/la candidat·e choisit son mot de passe via un lien
 * d'activation valable 7 jours — aucun mot de passe n'est communiqué.
 */
export async function approveApplication(id: string, opts: { allowIncomplete?: boolean } = {}): Promise<ApproveResult> {
  const session = await requireAdmin();
  const app = await prisma.consultantApplication.findUnique({ where: { id }, include: { signature: { select: { id: true } } } });
  if (!app) return { ok: false, error: "Candidature introuvable." };
  if (app.status !== "NOUVELLE") return { ok: false, error: "Candidature déjà traitée." };

  // Validation conditionnée à la pièce d'identité et au protocole signé.
  const complete = !!(app.idFront && app.idBack && app.idNumber && app.signature);
  if (!complete && !opts.allowIncomplete) {
    return { ok: false, error: "Dossier incomplet : pièce d'identité (recto et verso) et protocole signé sont obligatoires avant validation." };
  }
  if (!complete) await logActivity(session, `Candidature validée sans dossier complet : ${app.name}`, "ConsultantApplication", id);

  const email = app.email.toLowerCase();
  const exists = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, role: true, consultantId: true } });
  // Un compte revendeur déjà créé à la main, sans fiche : on le réutilise et on le rattache.
  const reuseUserId = exists && exists.role === "CONSULTANT" && !exists.consultantId ? exists.id : null;
  if (exists && !reuseUserId) return { ok: false, error: exists.role === "CONSULTANT" ? "Un compte revendeur existe déjà avec cet e-mail, rattaché à une autre fiche." : "Un compte (administrateur ou livreur) existe déjà avec cet e-mail." };

  // Nouvelle vérification : le parrain a pu atteindre sa limite depuis la candidature.
  const sponsor = app.sponsorCode
    ? await prisma.consultant.findFirst({ where: { slug: app.sponsorCode, active: true }, select: { id: true, name: true } })
    : null;
  if (!sponsor) return { ok: false, error: "Pas de parrain actif pour cette candidature : rattachez-la à un membre (code de parrainage) avant de l'accepter." };
  const capacity = await sponsorCapacity(sponsor.id, await getBusinessModel());
  if (!capacity.ok) return { ok: false, error: `${sponsorRefusal(sponsor.name, capacity)} Rattachez cette candidature à un autre membre.` };
  const slug = await uniqueConsultantSlug(app.name);
  const token = randomBytes(32).toString("base64url");
  // Mot de passe aléatoire inutilisable tant que le lien d'activation n'a pas été utilisé.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  await prisma.$transaction(async (tx) => {
    const consultant = await tx.consultant.create({
      data: {
        name: app.name, city: app.city, whatsapp: app.phone, email, active: true, slug, sponsorId: sponsor.id,
        rank: capacity.recruitTitle ? TITLE_RANK[capacity.recruitTitle] : null,
        address: app.address, idType: app.idType, idNumber: app.idNumber,
      },
    });
    if (app.signature) await tx.protocolSignature.update({ where: { id: app.signature.id }, data: { consultantId: consultant.id } });
    const user = reuseUserId
      ? await tx.user.update({ where: { id: reuseUserId }, data: { consultantId: consultant.id } })
      : await tx.user.create({ data: { email, name: app.name, passwordHash, role: "CONSULTANT", consultantId: consultant.id } });
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
