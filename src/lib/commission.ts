import { prisma } from "./prisma";
import { getCommissionRate } from "./settings";
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
}

export async function getConsultantCommission(consultantId: string): Promise<CommissionInfo> {
  const since = startOfMonth();

  const [rate, monthlyAgg, monthlyRefunded, lifetimeAgg, lifetimeRefunded] = await Promise.all([
    getCommissionRate(),
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
  ]);

  const monthlyRevenue = Math.max(0, (monthlyAgg._sum.total ?? 0) - monthlyRefunded);
  const lifetimeRevenue = Math.max(0, (lifetimeAgg._sum.total ?? 0) - lifetimeRefunded);

  return {
    rate,
    monthlyRevenue,
    monthlyCommission: Math.round((monthlyRevenue * rate) / 100),
    lifetimeRevenue,
    lifetimeCommission: Math.round((lifetimeRevenue * rate) / 100),
  };
}
