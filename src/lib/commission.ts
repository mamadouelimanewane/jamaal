import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { getBusinessModel } from "./business-model-store";
import { sponsorRatesFor } from "./business-model";
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

/**
 * Commandes qui ouvrent droit à commission : encaissées (paiement confirmé, ou paiement à la
 * livraison effectivement livré) et non annulées.
 */
export const COMMISSIONABLE_ORDER: Prisma.OrderWhereInput = {
  status: { not: "ANNULEE" },
  OR: [{ paymentStatus: "PAYE" }, { paymentMethod: "A_LA_LIVRAISON", status: "LIVREE" }],
};

/** Base de commission d'une commande : prix des produits, sans les frais de livraison. */
export function commissionBase(order: { total: number; deliveryFee?: number | null }): number {
  return Math.max(0, order.total - (order.deliveryFee ?? 0));
}

/** Ventes encaissées (hors livraison, remboursements déduits) d'un ou plusieurs consultants. */
export async function paidSales(consultantIds: string[], since?: Date): Promise<number> {
  if (!consultantIds.length) return 0;
  const [agg, refunded] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true, deliveryFee: true },
      where: {
        ...COMMISSIONABLE_ORDER,
        consultantId: { in: consultantIds },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    }),
    getRefundedTotal({ consultantIds, ...(since ? { since } : {}) }),
  ]);
  return Math.max(0, (agg._sum.total ?? 0) - (agg._sum.deliveryFee ?? 0) - refunded);
}

export async function getConsultantCommission(consultantId: string): Promise<CommissionInfo> {
  const since = startOfMonth();

  const [me, level1, model] = await Promise.all([
    prisma.consultant.findUnique({ where: { id: consultantId }, select: { sponsorId: true } }),
    prisma.consultant.findMany({ where: { sponsorId: consultantId }, select: { id: true } }),
    getBusinessModel(),
  ]);
  const l1Ids = level1.map((t) => t.id);
  const level2 = l1Ids.length
    ? await prisma.consultant.findMany({ where: { sponsorId: { in: l1Ids } }, select: { id: true } })
    : [];
  const l2Ids = level2.map((t) => t.id);

  const rate = model.sellerPct;
  // Parrain seul : il prend toute l'enveloppe (6 %) ; s'il a lui-même un parrain, il la partage (3 % + 3 %).
  const { level1: sponsorRate, level2: sponsorL2Rate } = sponsorRatesFor(!!me?.sponsorId, model);

  const [monthlyRevenue, lifetimeRevenue, monthlyTeamRevenue, lifetimeTeamRevenue, monthlyL2Revenue, lifetimeL2Revenue] =
    await Promise.all([
      paidSales([consultantId], since),
      paidSales([consultantId]),
      paidSales(l1Ids, since),
      paidSales(l1Ids),
      paidSales(l2Ids, since),
      paidSales(l2Ids),
    ]);

  const pct = (amount: number, r: number) => Math.round((amount * r) / 100);
  return {
    rate,
    monthlyRevenue,
    monthlyCommission: pct(monthlyRevenue, rate),
    lifetimeRevenue,
    lifetimeCommission: pct(lifetimeRevenue, rate),
    sponsorRate,
    monthlyTeamRevenue,
    monthlySponsorCommission: pct(monthlyTeamRevenue, sponsorRate),
    lifetimeTeamRevenue,
    lifetimeSponsorCommission: pct(lifetimeTeamRevenue, sponsorRate),
    sponsorL2Rate,
    monthlyL2Revenue,
    monthlyL2Commission: pct(monthlyL2Revenue, sponsorL2Rate),
    lifetimeL2Revenue,
    lifetimeL2Commission: pct(lifetimeL2Revenue, sponsorL2Rate),
  };
}
