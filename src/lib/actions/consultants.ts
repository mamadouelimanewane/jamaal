"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { getBusinessModel } from "@/lib/business-model-store";
import { sponsorCapacity } from "@/lib/network";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { slugify } from "@/lib/ref";
import { notifyResellerWelcome } from "@/lib/whatsapp/welcome";
import { isIdType } from "@/lib/protocol";
import { logActivity } from "@/lib/activity-log";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Photo de pièce d'identité facultative : rien si le champ est vide, sinon image de 3 Mo au plus. */
async function optionalIdPhoto(v: FormDataEntryValue | null, face: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string } | null> {
  if (!(v instanceof File) || v.size === 0) return null;
  if (!PHOTO_TYPES.includes(v.type)) throw new Error(`Photo ${face} : format accepté JPG, PNG ou WebP.`);
  if (v.size > 3 * 1024 * 1024) throw new Error(`Photo ${face} trop lourde (3 Mo au plus).`);
  return { bytes: new Uint8Array(await v.arrayBuffer()), mime: v.type };
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  if (!slug) slug = "consultant";
  let candidate = slug;
  let i = 2;
  while (true) {
    const existing = await prisma.consultant.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${slug}-${i}`;
    i += 1;
  }
}

function parseSlug(raw: string, name: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (cleaned.length >= 2) return cleaned.slice(0, 48);
  if (name.trim()) return null; // will be auto-generated
  return null;
}

async function consultantDataFromForm(formData: FormData, existingId?: string) {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const sponsorId = String(formData.get("sponsorId") ?? "") || null;
  const slugRaw = String(formData.get("slug") ?? "");

  let slug = parseSlug(slugRaw, name);
  if (!slug) {
    slug = await ensureUniqueSlug(name, existingId);
  } else {
    // Vérifier unicité si fourni manuellement
    const conflict = await prisma.consultant.findFirst({
      where: {
        slug,
        ...(existingId ? { id: { not: existingId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new Error(`Le slug « ${slug} » est déjà utilisé par un autre consultant.`);
    }
  }

  // Un membre ne peut pas être son propre parrain, et chaque parrain a un nombre limité de filleuls.
  if (sponsorId && sponsorId === existingId) throw new Error("Un consultant ne peut pas être son propre parrain.");
  if (sponsorId) {
    const capacity = await sponsorCapacity(sponsorId, await getBusinessModel(), existingId);
    if (!capacity.ok) {
      throw new Error(capacity.finalSeller
        ? "Ce parrain est Consultant (vendeur final) : il ne peut pas avoir de filleuls. Choisissez un Leader ou un Parrain."
        : `Ce ${capacity.title} a déjà ${capacity.max} ${capacity.title === "Leader" ? "Parrains" : "Consultants"} dans son équipe (maximum fixé dans le Modèle économique).`);
    }
  }

  // Identité (facultative) : adresse et pièce, modifiables à tout moment après l'enregistrement.
  const address = String(formData.get("address") ?? "").trim() || null;
  const rawType = String(formData.get("idType") ?? "");
  const idType = isIdType(rawType) ? rawType : rawType.trim() ? rawType.trim().slice(0, 40) : null;
  const idNumber = String(formData.get("idNumber") ?? "").trim().toUpperCase().slice(0, 30) || null;
  if (idNumber && !/^[A-Z0-9 -]{3,30}$/.test(idNumber)) throw new Error("Numéro de pièce invalide (lettres, chiffres, espaces et tirets).");

  return {
    name,
    city,
    whatsapp,
    email,
    active,
    sponsorId,
    slug,
    address,
    idType,
    idNumber,
  };
}

/** Enregistre les nouvelles photos de la pièce (seulement celles fournies : l'autre face est conservée). */
async function saveIdPhotos(id: string, formData: FormData) {
  const front = await optionalIdPhoto(formData.get("idFront"), "recto");
  const back = await optionalIdPhoto(formData.get("idBack"), "verso");
  if (!front && !back) return false;
  const data = { ...(front ? { front: front.bytes, mime: front.mime } : {}), ...(back ? { back: back.bytes, ...(front ? {} : { mime: back.mime }) } : {}) };
  await prisma.consultantPiece.upsert({ where: { consultantId: id }, create: { consultantId: id, ...data }, update: data });
  return true;
}

async function createConsultantImpl(formData: FormData) {
  await requireAdmin("revendeurs");
  const created = await prisma.consultant.create({ data: await consultantDataFromForm(formData), select: { id: true } });
  notifyResellerWelcome(created.id);
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

async function updateConsultantImpl(id: string, formData: FormData) {
  const session = await requireAdmin("revendeurs");
  const data = await consultantDataFromForm(formData, id);
  const photos = await saveIdPhotos(id, formData);
  await prisma.consultant.update({ where: { id }, data });
  await logActivity(session, `Fiche consultant modifiée : ${data.name}${photos ? " (pièce d'identité mise à jour)" : ""}`, "Consultant", id);
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

/**
 * « Supprimer » un consultant = l'archiver : rien n'est effacé (fiche, ventes, commissions, wallet, crédits de
 * marchandises, filleuls, historiques). Il ne peut plus se connecter et sa boutique est fermée ; restaurable.
 */
async function deleteConsultantImpl(id: string) {
  const session = await requireAdmin("revendeurs");
  await prisma.$transaction([
    prisma.consultant.update({ where: { id }, data: { archivedAt: new Date(), active: false } }),
    prisma.user.updateMany({ where: { consultantId: id, role: "CONSULTANT" }, data: { active: false } }),
  ]);
  await logActivity(session, "Consultant archivé (données conservées)", "Consultant", id).catch(() => {});
  revalidatePath("/admin/consultants");
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/consultants");
}

async function restoreConsultantImpl(id: string) {
  const session = await requireAdmin("revendeurs");
  await prisma.$transaction([
    prisma.consultant.update({ where: { id }, data: { archivedAt: null, active: true } }),
    prisma.user.updateMany({ where: { consultantId: id, role: "CONSULTANT" }, data: { active: true } }),
  ]);
  await logActivity(session, "Consultant restauré", "Consultant", id).catch(() => {});
  revalidatePath("/admin/consultants");
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/consultants");
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function createConsultant(formData: FormData): Promise<void> {
  try {
    await createConsultantImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/consultants");
  }
}

export async function updateConsultant(id: string, formData: FormData): Promise<void> {
  try {
    await updateConsultantImpl(id, formData);
  } catch (e) {
    await backWithError(e, "/admin/consultants");
  }
}

export async function deleteConsultant(id: string): Promise<void> {
  try {
    await deleteConsultantImpl(id);
  } catch (e) {
    await backWithError(e, "/admin/consultants");
  }
}

/** Remet un consultant archivé en activité (connexion et boutique rouvertes). */
export async function restoreConsultant(id: string): Promise<void> {
  try {
    await restoreConsultantImpl(id);
  } catch (e) {
    await backWithError(e, "/admin/consultants?archives=1");
  }
}

/** « Supprimer » depuis la liste : archive (avec message de confirmation affiché dans la ligne). */
export async function archiveConsultantAction(id: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    await deleteConsultantImpl(id);
    return { ok: true, message: "Supprimé : compte archivé, informations conservées." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Suppression impossible." };
  }
}
