import { prisma } from "./prisma";

export type ConsultantRank = "GOLD" | "SILVER" | "BRONZE" | null;

export const RANK_LABELS: Record<Exclude<ConsultantRank, null>, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
};

// Seuils ajustables : chiffre d'affaires du mois en cours (FCFA) OU nombre de
// filleuls actifs ce mois-ci (ayant réalisé au moins une vente) suffit à atteindre le rang.
const GOLD_REVENUE = 200_000;
const GOLD_ACTIVE_SPONSORED = 3;
const SILVER_REVENUE = 75_000;
const SILVER_ACTIVE_SPONSORED = 1;

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
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
 * Calcule le rang (Gold/Silver/Bronze) de chaque revendeur actif à partir de son
 * chiffre d'affaires du mois en cours et du nombre de filleuls actifs ce mois-ci.
 * Tout est recalculé à la volée — aucun rang n'est stocké en base.
 */
export async function getConsultantRankings(): Promise<ConsultantRankInfo[]> {
  const since = startOfMonth();

  const [consultants, revenueGroups, sponsorLinks] = await Promise.all([
    prisma.consultant.findMany({ select: { id: true, sponsorId: true } }),
    prisma.order.groupBy({
      by: ["consultantId"],
      _sum: { total: true },
      where: { consultantId: { not: null }, status: { not: "ANNULEE" }, createdAt: { gte: since } },
    }),
    prisma.order.findMany({
      where: { consultantId: { not: null }, status: { not: "ANNULEE" }, createdAt: { gte: since } },
      select: { consultantId: true },
      distinct: ["consultantId"],
    }),
  ]);

  const revenueByConsultant = new Map(revenueGroups.map((g) => [g.consultantId as string, g._sum.total ?? 0]));
  const activeConsultantIds = new Set(sponsorLinks.map((o) => o.consultantId as string));

  const activeSponsoredCount = new Map<string, number>();
  for (const c of consultants) {
    if (c.sponsorId && activeConsultantIds.has(c.id)) {
      activeSponsoredCount.set(c.sponsorId, (activeSponsoredCount.get(c.sponsorId) ?? 0) + 1);
    }
  }

  return consultants.map((c) => {
    const monthlyRevenue = revenueByConsultant.get(c.id) ?? 0;
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
