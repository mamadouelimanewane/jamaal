import { prisma } from "./prisma";
import {
  getCommissionRate,
  getSponsorCommissionRate,
  getSponsorL2CommissionRate,
} from "./settings";
import { getRefundedTotal } from "./revenue";

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export interface CommissionInfo {
  rate: number;
  monthlyRevenue: number;
  monthlyCommission: number;
  lifetimeRevenue: number;
  lifetimeCommission: number;
  sponsorRate: number;
  monthlyTeamRevenue: number;
  monthlySponsorCommission: number;
  lifetimeTeamRevenue: number;
  lifetimeSponsorCommission: number;
  sponsorL2Rate: number;
  monthlyL2Revenue: number;
  monthlyL2Commission: number;
  lifetimeL2Revenue: number;
  lifetimeL2Commission: number;
}

async function teamRevenue(
  teamIds: string[],
  since?: Date
): Promise<{ gross: number; refunded: number }> {
  if (!teamIds.length) return { gross: 0, refunded: 0 };
  const [agg, refunded] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        consultantId: { in: teamIds },
        status: { not: "ANNULEE" },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    }),
    getRefundedTotal({
      consultantIds: teamIds,
      ...(since ? { since } : {}),
    }),
  ]);
  return { gross: agg._sum.total ?? 0, refunded };
}

export async function getConsultantCommission(consultantId: string): Promise<CommissionInfo> {
  const since = startOfMonth();

  const level1 = await prisma.consultant.findMany({
    where: { sponsorId: consultantId },
    select: { id: true },
  });
  const l1Ids = level1.map((t) => t.id);

  const level2 = l1Ids.length
    ? await prisma.consultant.findMany({
        where: { sponsorId: { in: l1Ids } },
        select: { id: true },
      })
    : [];
  const l2Ids = level2.map((t) => t.id);

  const [
    rate,
    sponsorRate,
    sponsorL2Rate,
    monthlyAgg,
    monthlyRefunded,
    lifetimeAgg,
    lifetimeRefunded,
    monthlyL1,
    lifetimeL1,
    monthlyL2,
    lifetimeL2,
  ] = await Promise.all([
    getCommissionRate(),
    getSponsorCommissionRate(),
    getSponsorL2CommissionRate(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { consultantId, status: { not: "ANNULEE" }, createdAt: { gte: since } },
    }),
    getRefundedTotal({ consultantId, since }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { consultantId, status: { not: "ANNULEE" } },
    }),
    getRefundedTotal({ consultantId }),
    teamRevenue(l1Ids, since),
    teamRevenue(l1Ids),
    teamRevenue(l2Ids, since),
    teamRevenue(l2Ids),
  ]);

  const monthlyRevenue = Math.max(0, (monthlyAgg._sum.total ?? 0) - monthlyRefunded);
  const lifetimeRevenue = Math.max(0, (lifetimeAgg._sum.total ?? 0) - lifetimeRefunded);
  const monthlyTeamRevenue = Math.max(0, monthlyL1.gross - monthlyL1.refunded);
  const lifetimeTeamRevenue = Math.max(0, lifetimeL1.gross - lifetimeL1.refunded);
  const monthlyL2Revenue = Math.max(0, monthlyL2.gross - monthlyL2.refunded);
  const lifetimeL2Revenue = Math.max(0, lifetimeL2.gross - lifetimeL2.refunded);

  return {
    rate,
    monthlyRevenue,
    monthlyCommission: Math.round((monthlyRevenue * rate) / 100),
    lifetimeRevenue,
    lifetimeCommission: Math.round((lifetimeRevenue * rate) / 100),
    sponsorRate,
    monthlyTeamRevenue,
    monthlySponsorCommission: Math.round((monthlyTeamRevenue * sponsorRate) / 100),
    lifetimeTeamRevenue,
    lifetimeSponsorCommission: Math.round((lifetimeTeamRevenue * sponsorRate) / 100),
    sponsorL2Rate,
    monthlyL2Revenue,
    monthlyL2Commission: Math.round((monthlyL2Revenue * sponsorL2Rate) / 100),
    lifetimeL2Revenue,
    lifetimeL2Commission: Math.round((lifetimeL2Revenue * sponsorL2Rate) / 100),
  };
}
