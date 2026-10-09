/**
 * Chaîne JAMAAL :
 *
 *   JAMAAL
 *     └─ Leader (sommet d'une équipe, sans parrain)
 *          └─ Parrain direct (dans l'équipe d'un Leader)
 *               └─ Consultant, vendeur final (dans l'équipe d'un Parrain ; ne parraine pas)
 *
 * Le rang est attribué par l'admin (« Promouvoir en Leader / Parrain »). Sans rang enregistré,
 * il est déduit de la place dans la chaîne (sommet = Leader, son filleul = Parrain, puis Consultant).
 *
 * Commissions (Admin > Modèle économique) : sur la vente d'un Parrain, le Leader touche
 * l'enveloppe entière (6 %) ; sur la vente d'un Consultant, le Parrain direct et le Leader se
 * la partagent (3 % + 3 %). Chacun touche aussi sa part vendeur sur ses propres ventes.
 */
import { prisma } from "./prisma";
import type { BusinessModel } from "./business-model";

export type NetworkTitle = "Leader" | "Parrain" | "Consultant";
export type Rank = "LEADER" | "PARRAIN" | "CONSULTANT";

export const NETWORK_TITLES: NetworkTitle[] = ["Leader", "Parrain", "Consultant"];
export const RANKS: Rank[] = ["LEADER", "PARRAIN", "CONSULTANT"];
const RANK_TITLE: Record<Rank, NetworkTitle> = { LEADER: "Leader", PARRAIN: "Parrain", CONSULTANT: "Consultant" };
export const TITLE_RANK: Record<NetworkTitle, Rank> = { Leader: "LEADER", Parrain: "PARRAIN", Consultant: "CONSULTANT" };

/** Dernier niveau de la chaîne : le vendeur final ne peut pas avoir de filleuls. */
export const FINAL_SELLER_DEPTH = 2;

export const isRank = (v: unknown): v is Rank => typeof v === "string" && (RANKS as string[]).includes(v);

/** depth = nombre de parrains au-dessus (0 = sommet). */
export function titleForDepth(depth: number): NetworkTitle {
  if (depth <= 0) return "Leader";
  if (depth === 1) return "Parrain";
  return "Consultant";
}

/** Titre d'un membre : son rang attribué, sinon sa place dans la chaîne. */
export function effectiveTitle(rank: string | null | undefined, depth: number): NetworkTitle {
  return isRank(rank) ? RANK_TITLE[rank] : titleForDepth(depth);
}

/** Titre que prend un membre rattaché à ce parrain. Null : ce parrain ne recrute pas. */
export function recruitTitleFor(sponsorTitle: NetworkTitle): NetworkTitle | null {
  return sponsorTitle === "Leader" ? "Parrain" : sponsorTitle === "Parrain" ? "Consultant" : null;
}

/** Libellé détaillé pour l'affichage. */
export function titleLabel(title: NetworkTitle): string {
  return title === "Parrain" ? "Parrain direct" : title === "Consultant" ? "Consultant (vendeur final)" : "Leader";
}

/** Un membre à cette profondeur peut-il parrainer ? (le vendeur final, non) */
export function canSponsorAtDepth(depth: number): boolean {
  return depth < FINAL_SELLER_DEPTH;
}

export const canSponsor = (title: NetworkTitle) => title !== "Consultant";

type Limits = Pick<BusinessModel, "maxParrainsPerLeader" | "maxConsultantsPerParrain">;

/** Limite de l'équipe directe selon le rang (0 = illimitée, -1 = ne recrute pas). */
export function teamLimitFor(title: NetworkTitle, model: Limits): number {
  if (title === "Leader") return model.maxParrainsPerLeader;
  if (title === "Parrain") return model.maxConsultantsPerParrain;
  return -1;
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

/** Titre d'un membre (une ou deux requêtes). */
export async function getMemberTitle(consultantId: string): Promise<NetworkTitle> {
  const row = await prisma.consultant.findUnique({ where: { id: consultantId }, select: { rank: true } });
  if (isRank(row?.rank)) return RANK_TITLE[row.rank];
  return titleForDepth(await getNetworkDepth(consultantId));
}

/** Profondeur à partir d'un objet chargé avec sponsor { sponsorId } (sans requête supplémentaire). */
export function depthFromLoaded(c: { sponsorId: string | null; sponsor?: { sponsorId: string | null } | null }): number {
  if (!c.sponsorId) return 0;
  return c.sponsor?.sponsorId ? 2 : 1;
}

/** Titre à partir d'un objet chargé avec rank, sponsorId et sponsor { sponsorId }. */
export function titleFromLoaded(c: { rank?: string | null; sponsorId: string | null; sponsor?: { sponsorId: string | null } | null }): NetworkTitle {
  return effectiveTitle(c.rank, depthFromLoaded(c));
}

/**
 * Le parrain peut-il accueillir un nouveau membre direct ? Non s'il est Consultant (vendeur
 * final) ou si son équipe a atteint la limite de son rang (10 Parrains pour un Leader,
 * 20 Consultants pour un Parrain, réglables). `excludeId` : membre déjà rattaché qu'on ne compte pas.
 */
export async function sponsorCapacity(sponsorId: string, model: Limits, excludeId?: string) {
  const [count, title] = await Promise.all([
    prisma.consultant.count({ where: { sponsorId, ...(excludeId ? { id: { not: excludeId } } : {}) } }),
    getMemberTitle(sponsorId),
  ]);
  const limit = teamLimitFor(title, model);
  const finalSeller = limit < 0;
  return { ok: !finalSeller && (limit === 0 || count < limit), count, max: Math.max(0, limit), finalSeller, title, recruitTitle: recruitTitleFor(title) };
}

/** Message d'erreur quand un parrain ne peut pas accueillir de membre. */
export function sponsorRefusal(name: string, capacity: { finalSeller: boolean; max: number; title?: NetworkTitle }): string {
  if (capacity.finalSeller) return `${name} est Consultant (vendeur final) et ne parraine pas. Demandez le code de son Parrain ou de son Leader.`;
  const who = capacity.title === "Leader" ? "Parrains" : capacity.title === "Parrain" ? "Consultants" : "membres";
  return `${name} a déjà ${capacity.max} ${who} dans son équipe, le maximum. Demandez le code d'un autre membre de l'équipe.`;
}

/** Membres pouvant parrainer (Leaders et Parrains), avec leur titre : listes de choix admin. */
export async function sponsorOptionsList() {
  const rows = await prisma.consultant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, rank: true, sponsorId: true, sponsor: { select: { sponsorId: true } } },
  });
  return rows
    .map((r) => ({ id: r.id, name: r.name, city: r.city, title: titleFromLoaded(r) }))
    .filter((r) => canSponsor(r.title))
    .map((r) => ({ id: r.id, name: r.name, city: r.city, title: titleLabel(r.title) }));
}
