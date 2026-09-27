import { prisma } from "./prisma";

export type ConsultantRank = "GOLD" | "SILVER" | "BRONZE" | null;

export const RANK_LABELS: Record<Exclude<ConsultantRank, null>, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
};

// Seuils ajustables : chiffre d'affaires du mois en cours (FCFA, net des remboursements)
// OU nombre de filleuls actifs ce mois-ci (ayant réalisé au moins une vente) suffit à atteindre le rang.
const GOLD_REVENUE = 200_000;
const GOLD_ACTIVE_SPONSORED = 3;
const SILVER_REVENUE = 75_000;
const SILVER_ACTIVE_SPONSORED = 1;

function startOfMonth(offsetMonths = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
}

export interface ConsultantRankInfo {
  consultantId: string;
  monthlyRevenue: number;
  activeSponsoredCount: number;
  rank: ConsultantRank;
}

function rankFromStats(monthlyRevenue: number, activeSponsoredCount: number): ConsultantRank {
  if (monthlyRevenue >= GOLD_REVENUE || activeSponsoredCount >= GOLD_ACTIVE_SPONSORED) return "GOLD";
  if (monthlyRevenue >= SILVER_REVENUE || activeSponsoredCount >= SILVER_ACTIVE_SPONSORED) return "SILVER";
  if (monthlyRevenue > 0) return "BRONZE";
  return null;
}

/**
 * Calcule le rang (Gold/Silver/Bronze) de chaque revendeur pour un mois donné
 * (par défaut le mois en cours) à partir de son CA net (remboursements déduits)
 * et du nombre de filleuls actifs ce mois-là. Rien n'est stocké en base : tout
 * est recalculé à la volée, y compris pour les mois passés (historique).
 */
export async function getConsultantRankings(monthOffset = 0): Promise<ConsultantRankInfo[]> {
  const since = startOfMonth(monthOffset);
  const until = startOfMonth(monthOffset + 1);

  const [consultants, revenueGroups, refundGroups, sponsorLinks] = await Promise.all([
    prisma.consultant.findMany({ select: { id: true, sponsorId: true } }),
    prisma.order.groupBy({
      by: ["consultantId"],
      _sum: { total: true },
      where: {
        consultantId: { not: null },
        status: { not: "ANNULEE" },
        createdAt: { gte: since, lt: until },
      },
    }),
    prisma.return.groupBy({
      by: ["orderId"],
      _sum: { amount: true },
      where: { status: "REMBOURSE", order: { createdAt: { gte: since, lt: until } } },
    }),
    prisma.order.findMany({
      where: {
        consultantId: { not: null },
        status: { not: "ANNULEE" },
        createdAt: { gte: since, lt: until },
      },
      select: { consultantId: true },
      distinct: ["consultantId"],
    }),
  ]);

  // Retrouver à quel consultant appartient chaque commande remboursée, pour déduire le net.
  const refundedOrderIds = refundGroups.map((r) => r.orderId);
  const refundedOrders = refundedOrderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: refundedOrderIds } },
        select: { id: true, consultantId: true },
      })
    : [];
  const consultantByOrder = new Map(refundedOrders.map((o) => [o.id, o.consultantId]));
  const refundByConsultant = new Map<string, number>();
  for (const r of refundGroups) {
    const consultantId = consultantByOrder.get(r.orderId);
    if (!consultantId) continue;
    refundByConsultant.set(consultantId, (refundByConsultant.get(consultantId) ?? 0) + (r._sum.amount ?? 0));
  }

  const revenueByConsultant = new Map(revenueGroups.map((g) => [g.consultantId as string, g._sum.total ?? 0]));
  const activeConsultantIds = new Set(sponsorLinks.map((o) => o.consultantId as string));

  const activeSponsoredCount = new Map<string, number>();
  for (const c of consultants) {
    if (c.sponsorId && activeConsultantIds.has(c.id)) {
      activeSponsoredCount.set(c.sponsorId, (activeSponsoredCount.get(c.sponsorId) ?? 0) + 1);
    }
  }

  return consultants.map((c) => {
    const gross = revenueByConsultant.get(c.id) ?? 0;
    const refunded = refundByConsultant.get(c.id) ?? 0;
    const monthlyRevenue = Math.max(0, gross - refunded);
    const sponsoredCount = activeSponsoredCount.get(c.id) ?? 0;
    return {
      consultantId: c.id,
      monthlyRevenue,
      activeSponsoredCount: sponsoredCount,
      rank: rankFromStats(monthlyRevenue, sponsoredCount),
    };
  });
}

export async function getConsultantRank(consultantId: string): Promise<ConsultantRankInfo> {
  const all = await getConsultantRankings();
  return (
    all.find((r) => r.consultantId === consultantId) ?? {
      consultantId,
      monthlyRevenue: 0,
      activeSponsoredCount: 0,
      rank: null,
    }
  );
}

export interface RankProgress {
  nextRank: Exclude<ConsultantRank, null> | null;
  revenueNeeded: number;
  sponsoredNeeded: number;
}

/** De combien un revendeur est-il proche du rang supérieur ? */
export function getProgressToNextRank(info: ConsultantRankInfo): RankProgress {
  if (info.rank === "GOLD") return { nextRank: null, revenueNeeded: 0, sponsoredNeeded: 0 };

  const targetRevenue = info.rank === "SILVER" ? GOLD_REVENUE : SILVER_REVENUE;
  const targetSponsored = info.rank === "SILVER" ? GOLD_ACTIVE_SPONSORED : SILVER_ACTIVE_SPONSORED;
  const nextRank = info.rank === "SILVER" ? "GOLD" : "SILVER";

  return {
    nextRank,
    revenueNeeded: Math.max(0, targetRevenue - info.monthlyRevenue),
    sponsoredNeeded: Math.max(0, targetSponsored - info.activeSponsoredCount),
  };
}

export interface MonthlyRankSnapshot {
  year: number;
  month: number; // 1-12
  label: string;
  rank: ConsultantRank;
  monthlyRevenue: number;
}

/** Historique du rang d'un revendeur sur les N derniers mois (mois en cours inclus). */
export async function getConsultantRankHistory(
  consultantId: string,
  monthsBack = 6
): Promise<MonthlyRankSnapshot[]> {
  const results: MonthlyRankSnapshot[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const rankings = await getConsultantRankings(-i);
    const info = rankings.find((r) => r.consultantId === consultantId);
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    results.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      rank: info?.rank ?? null,
      monthlyRevenue: info?.monthlyRevenue ?? 0,
    });
  }
  return results;
}

export interface LeaderboardEntry {
  consultantId: string;
  name: string;
  city: string;
  monthlyRevenue: number;
  rank: ConsultantRank;
}

/** Top N revendeurs du mois en cours, pour le "concours du mois". */
export async function getMonthlyLeaderboard(limit = 3): Promise<LeaderboardEntry[]> {
  const [rankings, consultants] = await Promise.all([
    getConsultantRankings(),
    prisma.consultant.findMany({ select: { id: true, name: true, city: true } }),
  ]);
  const nameById = new Map(consultants.map((c) => [c.id, c]));

  return rankings
    .filter((r) => r.monthlyRevenue > 0)
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .slice(0, limit)
    .map((r) => ({
      consultantId: r.consultantId,
      name: nameById.get(r.consultantId)?.name ?? "—",
      city: nameById.get(r.consultantId)?.city ?? "",
      monthlyRevenue: r.monthlyRevenue,
      rank: r.rank,
    }));
}
