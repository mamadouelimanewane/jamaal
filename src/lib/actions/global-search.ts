"use server";

import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/access";
import { backofficeSearch, type BoResult } from "@/lib/backoffice-search";
import { requireStaff } from "./auth-guard";

/**
 * Recherche instantanée de la barre du back-office. Les droits sont relus en base (rôle, profil, fiche
 * rattachée), jamais pris de la session seule : chacun ne trouve que ce qu'il a le droit de voir.
 */
export async function globalAdminSearch(query: string): Promise<BoResult | null> {
  const session = await requireStaff();
  const userId = session.user?.id;
  if (!userId || query.trim().length < 2) return null;
  const [access, user] = await Promise.all([
    getAccess(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { consultantId: true, livreurId: true } }),
  ]);
  if (!access) return null;
  return backofficeSearch({ role: access.role, perms: access.perms, consultantId: user?.consultantId ?? null, livreurId: user?.livreurId ?? null }, query);
}
