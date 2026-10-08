"use server";

import { revalidatePath } from "next/cache";
import { getBusinessModel } from "@/lib/business-model-store";
import { sponsorCapacity } from "@/lib/network";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { slugify } from "@/lib/ref";

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
    const { maxDirectRecruits } = await getBusinessModel();
    const capacity = await sponsorCapacity(sponsorId, maxDirectRecruits, existingId);
    if (!capacity.ok) {
      throw new Error(capacity.finalSeller
        ? "Ce parrain est Consultant (vendeur final) : il ne peut pas avoir de filleuls. Choisissez un Leader ou un Parrain."
        : `Ce parrain a déjà ${capacity.max} filleuls directs (maximum fixé dans le Modèle économique).`);
    }
  }

  return {
    name,
    city,
    whatsapp,
    email,
    active,
    sponsorId,
    slug,
  };
}

export async function createConsultant(formData: FormData) {
  await requireAdmin();
  await prisma.consultant.create({ data: await consultantDataFromForm(formData) });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

export async function updateConsultant(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.consultant.update({
    where: { id },
    data: await consultantDataFromForm(formData, id),
  });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
  redirect("/admin/consultants");
}

export async function deleteConsultant(id: string) {
  await requireAdmin();
  await prisma.consultant.delete({ where: { id } });
  revalidatePath("/admin/consultants");
  revalidatePath("/consultants");
}
