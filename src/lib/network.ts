/**
 * Chaîne JAMAAL selon la position dans le parrainage :
 *
 *   JAMAAL
 *     └─ Leader (sommet du réseau, sans parrain)
 *          └─ Parrain direct (recruté par un leader)
 *               └─ Consultant, vendeur final (recruté par un parrain ; ne parraine pas)
 *
 * Commissions (Admin > Modèle économique) : sur la vente d'un Parrain, le Leader touche
 * l'enveloppe entière (6 %) ; sur la vente d'un Consultant, le Parrain direct et le Leader se
 * la partagent (3 % + 3 %). Chacun touche aussi sa part vendeur sur ses propres ventes.
 */
import { prisma } from "./prisma";

export type NetworkTitle = "Leader" | "Parrain" | "Consultant";

export const NETWORK_TITLES: NetworkTitle[] = ["Leader", "Parrain", "Consultant"];

/** Dernier niveau de la chaîne : le vendeur final ne peut pas avoir de filleuls. */
export const FINAL_SELLER_DEPTH = 2;

/** depth = nombre de parrains au-dessus (0 = sommet). */
export function titleForDepth(depth: number): NetworkTitle {
  if (depth <= 0) return "Leader";
  if (depth === 1) return "Parrain";
  return "Consultant";
}

/** Libellé détaillé pour l'affichage. */
export function titleLabel(title: NetworkTitle): string {
  return title === "Parrain" ? "Parrain direct" : title === "Consultant" ? "Consultant (vendeur final)" : "Leader";
}

/** Un membre à cette profondeur peut-il parrainer ? (le vendeur final, non) */
export function canSponsorAtDepth(depth: number): boolean {
  return depth < FINAL_SELLER_DEPTH;
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
 * Le parrain peut-il accueillir un nouveau filleul direct ? Non s'il est vendeur final
 * (Consultant, bas de la chaîne) ou s'il a atteint la limite du modèle économique
 * (0 = illimitée). `excludeId` : membre déjà rattaché qu'on ne compte pas (modification).
 */
export async function sponsorCapacity(sponsorId: string, max: number, excludeId?: string) {
  const [count, depth] = await Promise.all([
    prisma.consultant.count({ where: { sponsorId, ...(excludeId ? { id: { not: excludeId } } : {}) } }),
    getNetworkDepth(sponsorId),
  ]);
  const finalSeller = !canSponsorAtDepth(depth);
  return { ok: !finalSeller && (max <= 0 || count < max), count, max, finalSeller };
}

/** Message d'erreur quand un parrain ne peut pas accueillir de filleul. */
export function sponsorRefusal(name: string, capacity: { finalSeller: boolean; max: number }): string {
  return capacity.finalSeller
    ? `${name} est Consultant (vendeur final) et ne peut pas parrainer. Demandez le code de son Parrain ou de son Leader.`
    : `${name} a déjà ${capacity.max} filleuls directs, le maximum. Demandez le code d'un membre de son équipe.`;
}

/** Membres pouvant parrainer (Leaders et Parrains), avec leur titre : listes de choix admin. */
export async function sponsorOptionsList() {
  const rows = await prisma.consultant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, sponsorId: true, sponsor: { select: { sponsorId: true } } },
  });
  return rows
    .map((r) => ({ id: r.id, name: r.name, city: r.city, depth: depthFromLoaded(r) }))
    .filter((r) => canSponsorAtDepth(r.depth))
    .map((r) => ({ id: r.id, name: r.name, city: r.city, title: titleLabel(titleForDepth(r.depth)) }));
}
