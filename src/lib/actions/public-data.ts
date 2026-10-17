"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Nom lisible du revendeur d'un lien personnel (« Awa Diop (Dakar) »), ou null si le code est inconnu. */
export async function getConsultantLabelBySlug(slug: string): Promise<string | null> {
  const clean = String(slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,48}$/.test(clean)) return null;
  const c = await prisma.consultant.findFirst({ where: { slug: clean, active: true }, select: { name: true, city: true } });
  return c ? `${c.name} (${c.city})` : null;
}

/** Nom et téléphone d'un client connecté (compte client), pour pré-remplir la commande. Rien pour un visiteur anonyme. */
export async function getCheckoutPrefill(): Promise<{ name: string; phone: string } | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CLIENT") return null;
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, phone: true, customer: { select: { name: true, phone: true } } } });
  if (!u) return null;
  const phone = u.customer?.phone ?? u.phone ?? "";
  const name = u.customer?.name ?? u.name ?? "";
  return name || phone ? { name, phone } : null;
}

export async function getActiveConsultantsForCheckout() {
  const consultants = await prisma.consultant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, slug: true },
  });
  return consultants;
}
