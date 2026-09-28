import { prisma } from "./prisma";

/**
 * Total remboursé (retours au statut REMBOURSE) sur les commandes correspondant au filtre.
 * À soustraire du chiffre d'affaires brut pour obtenir un CA net fiable.
 */
export async function getRefundedTotal(where?: {
  consultantId?: string;
  consultantIds?: string[];
  since?: Date;
}): Promise<number> {
  const orderFilter: {
    consultantId?: string | { in: string[] };
    createdAt?: { gte: Date };
  } = {};

  if (where?.consultantIds?.length) {
    orderFilter.consultantId = { in: where.consultantIds };
  } else if (where?.consultantId) {
    orderFilter.consultantId = where.consultantId;
  }
  if (where?.since) {
    orderFilter.createdAt = { gte: where.since };
  }

  const agg = await prisma.return.aggregate({
    _sum: { amount: true },
    where: {
      status: "REMBOURSE",
      ...(Object.keys(orderFilter).length > 0 ? { order: orderFilter } : {}),
    },
  });
  return agg._sum.amount ?? 0;
}
