"use server";

import { prisma } from "@/lib/prisma";

/** Nom lisible du revendeur d'un lien personnel (« Awa Diop (Dakar) »), ou null si le code est inconnu. */
export async function getConsultantLabelBySlug(slug: string): Promise<string | null> {
  const clean = String(slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,48}$/.test(clean)) return null;
  const c = await prisma.consultant.findFirst({ where: { slug: clean, active: true }, select: { name: true, city: true } });
  return c ? `${c.name} (${c.city})` : null;
}

export async function getActiveConsultantsForCheckout() {
  const consultants = await prisma.consultant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, slug: true },
  });
  return consultants;
}
