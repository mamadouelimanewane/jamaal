/**
 * Défis du mois des revendeurs : classement en direct (nombre de ventes ou chiffre d'affaires
 * encaissé, hors livraison) sur la période du défi.
 */
import { prisma } from "@/lib/prisma";

export type ChallengeMetric = "VENTES" | "CA";
export const METRIC_LABELS: Record<ChallengeMetric, string> = { VENTES: "ventes", CA: "FCFA encaissés" };

export interface Standing {
  consultantId: string;
  name: string;
  city: string;
  value: number;
  reached: boolean;
}

/** Valeur comptée : une commande non annulée, payée ou livrée, passée pendant le défi. */
export async function challengeStandings(ch: { metric: string; target: number; startsAt: Date; endsAt: Date }): Promise<Standing[]> {
  const orders = await prisma.order.groupBy({
    by: ["consultantId"],
    where: {
      consultantId: { not: null },
      status: { not: "ANNULEE" },
      createdAt: { gte: ch.startsAt, lte: ch.endsAt },
      OR: [{ paymentStatus: "PAYE" }, { status: "LIVREE" }],
    },
    _count: { _all: true },
    _sum: { total: true, deliveryFee: true },
  });
  const ids = orders.map((o) => o.consultantId!).filter(Boolean);
  const consultants = await prisma.consultant.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true, city: true } });
  const byId = new Map(consultants.map((c) => [c.id, c]));
  return orders
    .flatMap((o) => {
      const c = byId.get(o.consultantId!);
      if (!c) return [];
      const value = ch.metric === "CA" ? Math.max(0, (o._sum.total ?? 0) - (o._sum.deliveryFee ?? 0)) : o._count._all;
      return [{ consultantId: c.id, name: c.name, city: c.city, value, reached: value >= ch.target }];
    })
    .sort((a, b) => b.value - a.value);
}

export async function activeChallenges(now = new Date()) {
  return prisma.challenge.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: { endsAt: "asc" } });
}
