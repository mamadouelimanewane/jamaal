/**
 * Titres du réseau JAMAAL selon la position dans la chaîne de parrainage :
 *
 *   Consultant (sommet, sans parrain)
 *     └─ Leader (filleul d'un consultant)
 *          └─ Parrain (recruté par un leader)
 *
 * Commissions (Admin > Modèle économique) : sur la vente d'un Leader, le Consultant touche
 * l'enveloppe entière (6 %) ; sur la vente d'un Parrain, le Leader et le Consultant se la
 * partagent (3 % + 3 %).
 */
import { prisma } from "./prisma";

export type NetworkTitle = "Consultant" | "Leader" | "Parrain";

export const NETWORK_TITLES: NetworkTitle[] = ["Consultant", "Leader", "Parrain"];

/** depth = nombre de parrains au-dessus (0 = sommet). */
export function titleForDepth(depth: number): NetworkTitle {
  if (depth <= 0) return "Consultant";
  if (depth === 1) return "Leader";
  return "Parrain";
}

export function pluralTitle(title: NetworkTitle): string {
  return `${title}s`;
}

/** Profondeur d'un membre (remonte la chaîne de parrainage, au plus 5 niveaux). */
export async function getNetworkDepth(consultantId: string): Promise<number> {
  let depth = 0;
  let current: string | null = consultantId;
  const seen = new Set<string>();
  while (current && depth < 5 && !seen.has(current)) {
    seen.add(current);
    const row: { sponsorId: string | null } | null = await prisma.consultant.findUnique({ where: { id: current }, select: { sponsorId: true } });
    if (!row?.sponsorId) break;
    depth += 1;
    current = row.sponsorId;
  }
  return depth;
}

/** Profondeur à partir d'un objet chargé avec sponsor { sponsorId } (sans requête supplémentaire). */
export function depthFromLoaded(c: { sponsorId: string | null; sponsor?: { sponsorId: string | null } | null }): number {
  if (!c.sponsorId) return 0;
  return c.sponsor?.sponsorId ? 2 : 1;
}

/**
 * Le parrain peut-il accueillir un nouveau filleul direct ? (limite du modèle économique,
 * 0 = illimitée). `excludeId` : membre déjà rattaché qu'on ne compte pas (modification).
 */
export async function sponsorCapacity(sponsorId: string, max: number, excludeId?: string) {
  const count = await prisma.consultant.count({
    where: { sponsorId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return { ok: max <= 0 || count < max, count, max };
}
