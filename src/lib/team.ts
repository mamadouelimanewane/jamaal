/**
 * Équipes du réseau : rangs attribués par l'admin, rattachement et retrait des membres,
 * primes d'équipe mensuelles. Fichier serveur.
 */
import { prisma } from "./prisma";
import type { BusinessModel, PrimeTier } from "./business-model";
import { primeStatus } from "./business-model";
import { COMMISSIONABLE_ORDER } from "./commission";
import { getMemberTitle, isRank, recruitTitleFor, sponsorCapacity, teamLimitFor, titleFromLoaded, TITLE_RANK, type NetworkTitle, type Rank } from "./network";

export class TeamError extends Error {}

const withChain = { rank: true, sponsorId: true, sponsor: { select: { sponsorId: true } } } as const;

/**
 * Fige le rang des membres indiqués (rang déduit → rang enregistré) avant un changement de
 * structure, pour qu'un déplacement ne change pas le titre des autres.
 */
async function freezeRanks(ids: string[]) {
  if (!ids.length) return;
  const rows = await prisma.consultant.findMany({ where: { id: { in: ids }, rank: null }, select: { id: true, ...withChain } });
  for (const r of rows) await prisma.consultant.update({ where: { id: r.id }, data: { rank: TITLE_RANK[titleFromLoaded(r)] } });
}

async function teamIds(id: string) {
  const l1 = await prisma.consultant.findMany({ where: { sponsorId: id }, select: { id: true } });
  const l1Ids = l1.map((c) => c.id);
  const l2 = l1Ids.length ? await prisma.consultant.findMany({ where: { sponsorId: { in: l1Ids } }, select: { id: true } }) : [];
  return { l1: l1Ids, l2: l2.map((c) => c.id) };
}

/**
 * Change le rang d'un membre (admin) en gardant une chaîne cohérente :
 * - Leader : quitte son équipe (plus de parrain) et garde la sienne ;
 * - Parrain : rattaché à un Leader (s'il était sous un Parrain, il remonte sous le Leader) ;
 * - Consultant : seulement s'il n'a pas d'équipe.
 */
export async function setMemberRank(id: string, rank: Rank, model: Pick<BusinessModel, "maxParrainsPerLeader" | "maxConsultantsPerParrain">) {
  const me = await prisma.consultant.findUnique({ where: { id }, select: { id: true, name: true, ...withChain } });
  if (!me) throw new TeamError("Membre introuvable.");
  const { l1, l2 } = await teamIds(id);
  await freezeRanks([id, ...l1, ...l2]);
  const current = titleFromLoaded(me);

  if (rank === "LEADER") {
    await prisma.consultant.update({ where: { id }, data: { rank, sponsorId: null } });
    return { message: `${me.name} est maintenant Leader${me.sponsorId ? " : il a quitté son ancienne équipe et garde la sienne" : ""}.` };
  }

  if (rank === "PARRAIN") {
    if (l1.length && current === "Leader") {
      const leaders = await prisma.consultant.count({ where: { id: { in: l1 }, rank: "PARRAIN" } });
      if (leaders) throw new TeamError(`${me.name} dirige ${leaders} Parrain(s) : rattachez-les d'abord à un autre Leader.`);
    }
    let sponsorId = me.sponsorId;
    if (sponsorId) {
      const sponsorTitle = await getMemberTitle(sponsorId);
      if (sponsorTitle !== "Leader") {
        const s = await prisma.consultant.findUnique({ where: { id: sponsorId }, select: { sponsorId: true } });
        sponsorId = s?.sponsorId && (await getMemberTitle(s.sponsorId)) === "Leader" ? s.sponsorId : null;
      }
    }
    if (sponsorId && sponsorId !== me.sponsorId) {
      const cap = await sponsorCapacity(sponsorId, model, id);
      if (!cap.ok) throw new TeamError(`Le Leader de son équipe est complet (${cap.max} Parrains). Libérez une place ou choisissez un autre Leader.`);
    }
    await prisma.consultant.update({ where: { id }, data: { rank, sponsorId } });
    return {
      message: sponsorId
        ? `${me.name} est maintenant Parrain${sponsorId !== me.sponsorId ? ", rattaché au Leader de son équipe" : ""}.`
        : `${me.name} est maintenant Parrain, sans Leader pour l'instant (membre libre : un Leader peut le rattacher avec son code).`,
    };
  }

  if (l1.length) throw new TeamError(`${me.name} a ${l1.length} membre(s) dans son équipe : rattachez-les d'abord à quelqu'un d'autre.`);
  await prisma.consultant.update({ where: { id }, data: { rank } });
  return { message: `${me.name} est maintenant Consultant (vendeur final).` };
}

/** Le responsable retire un membre de son équipe : le membre devient libre, ses gains acquis restent. */
export async function removeFromTeam(sponsorId: string, memberId: string) {
  const member = await prisma.consultant.findUnique({ where: { id: memberId }, select: { id: true, name: true, sponsorId: true } });
  if (!member || member.sponsorId !== sponsorId) throw new TeamError("Ce membre ne fait pas partie de votre équipe.");
  const { l1, l2 } = await teamIds(memberId);
  await freezeRanks([memberId, ...l1, ...l2]);
  await prisma.consultant.update({ where: { id: memberId }, data: { sponsorId: null } });
  return { message: `${member.name} a quitté votre équipe. Ses commissions déjà acquises sont conservées ; ses prochaines ventes ne vous rapportent plus.` };
}

/** Rattache un membre libre (sans équipe) avec son code. */
export async function addToTeam(sponsorId: string, code: string, model: Pick<BusinessModel, "maxParrainsPerLeader" | "maxConsultantsPerParrain">) {
  const slug = code.trim().toLowerCase().replace(/^.*\/c\//, "").replace(/[^\w-]/g, "");
  if (!slug) throw new TeamError("Saisissez le code du membre (son identifiant JAMAAL).");
  const member = await prisma.consultant.findFirst({ where: { slug, active: true }, select: { id: true, name: true, rank: true, sponsorId: true } });
  if (!member) throw new TeamError("Aucun membre actif avec ce code.");
  if (member.id === sponsorId) throw new TeamError("Vous ne pouvez pas vous ajouter vous-même.");
  if (member.sponsorId === sponsorId) throw new TeamError(`${member.name} fait déjà partie de votre équipe.`);
  if (member.sponsorId) throw new TeamError(`${member.name} fait partie d'une autre équipe : il doit d'abord en être retiré par son responsable ou par JAMAAL.`);
  if (!isRank(member.rank) || member.rank === "LEADER") throw new TeamError(`${member.name} est Leader : seul JAMAAL peut changer son rang.`);
  const cap = await sponsorCapacity(sponsorId, model);
  if (!cap.ok) throw new TeamError(cap.finalSeller ? "En tant que Consultant (vendeur final), vous ne recrutez pas." : `Votre équipe est complète (${cap.max} ${cap.title === "Leader" ? "Parrains" : "Consultants"} au maximum).`);
  const newTitle = cap.recruitTitle as NetworkTitle;
  if (newTitle === "Consultant") {
    const own = await prisma.consultant.count({ where: { sponsorId: member.id } });
    if (own) throw new TeamError(`${member.name} a sa propre équipe (${own} membre(s)) : il rejoint un Leader, pas un Parrain.`);
  }
  await prisma.consultant.update({ where: { id: member.id }, data: { sponsorId, rank: TITLE_RANK[newTitle] } });
  return { message: `${member.name} a rejoint votre équipe comme ${newTitle}.` };
}

// ---------- Primes d'équipe ----------

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function monthRange(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1), label: new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
}

/** Ventes encaissées (hors livraison, remboursements déduits) de membres sur une période. */
export async function salesBetween(ids: string[], start: Date, end: Date) {
  if (!ids.length) return 0;
  const [agg, refunds] = await Promise.all([
    prisma.order.aggregate({ _sum: { total: true, deliveryFee: true }, where: { ...COMMISSIONABLE_ORDER, consultantId: { in: ids }, createdAt: { gte: start, lt: end } } }),
    prisma.return.aggregate({ _sum: { amount: true }, where: { status: "REMBOURSE", order: { consultantId: { in: ids }, createdAt: { gte: start, lt: end } } } }),
  ]);
  return Math.max(0, (agg._sum.total ?? 0) - (agg._sum.deliveryFee ?? 0) - (refunds._sum.amount ?? 0));
}

export type TeamPrimeRow = {
  consultantId: string;
  name: string;
  title: "Leader" | "Parrain";
  members: number;
  teamSales: number;
  tier: PrimeTier | null;
  amount: number;
};

/** Primes d'équipe d'un mois : Leader sur le CA de toute son équipe, Parrain sur celui de ses Consultants. */
export async function computeTeamPrimes(key: string, model: BusinessModel): Promise<TeamPrimeRow[]> {
  const range = monthRange(key);
  if (!range) return [];
  const members = await prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, ...withChain } });
  const rows: TeamPrimeRow[] = [];
  for (const m of members) {
    const title = titleFromLoaded(m);
    if (title === "Consultant") continue;
    const { l1, l2 } = await teamIds(m.id);
    const ids = title === "Leader" ? [...l1, ...l2] : l1;
    if (!ids.length) continue;
    const teamSales = await salesBetween(ids, range.start, range.end);
    const tiers = title === "Leader" ? model.leaderTeamTiers : model.parrainTeamTiers;
    const tier = primeStatus(teamSales, model, tiers).reached;
    rows.push({ consultantId: m.id, name: m.name, title, members: ids.length, teamSales, tier, amount: tier?.amount ?? 0 });
  }
  return rows.sort((a, b) => b.teamSales - a.teamSales);
}

/** Référence d'une prime d'équipe dans le journal des commissions (une seule par membre et par mois). */
export const primeRef = (key: string) => `PRIME-EQUIPE-${key}`;

/** Résumé pour « Mon équipe » : membres, limite, titre de mes recrues. */
export async function teamSummary(id: string, model: BusinessModel) {
  const title = await getMemberTitle(id);
  return { title, limit: teamLimitFor(title, model), recruitTitle: recruitTitleFor(title) };
}
