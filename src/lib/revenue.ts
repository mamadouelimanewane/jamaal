import { prisma } from "./prisma";

/**
 * Total remboursé (retours au statut REMBOURSE) sur les commandes correspondant au filtre.
 * À soustraire du chiffre d'affaires brut pour obtenir un CA net fiable.
 */
export async function getRefundedTotal(where?: { consultantId?: string; since?: Date }): Promise<number> {
  const agg = await prisma.return.aggregate({
    _sum: { amount: true },
    where: {
      status: "REMBOURSE",
      order: {
        ...(where?.consultantId ? { consultantId: where.consultantId } : {}),
        ...(where?.since ? { createdAt: { gte: where.since } } : {}),
      },
    },
  });
  return agg._sum.amount ?? 0;
}
