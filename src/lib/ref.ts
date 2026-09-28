import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const REF_COOKIE = "jamaal_ref";
export const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

/** Résout un slug consultant → id (actif uniquement). */
export async function resolveConsultantBySlug(slug: string) {
  if (!slug?.trim()) return null;
  return prisma.consultant.findFirst({
    where: { slug: slug.trim().toLowerCase(), active: true },
    select: { id: true, name: true, city: true, whatsapp: true, slug: true },
  });
}

/** Lit le cookie ref côté serveur et retourne le consultant. */
export async function getRefConsultant() {
  const jar = await cookies();
  const slug = jar.get(REF_COOKIE)?.value;
  if (!slug) return null;
  return resolveConsultantBySlug(slug);
}

/** Génère un slug URL-safe à partir d'un nom. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
