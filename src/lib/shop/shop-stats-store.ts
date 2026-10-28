import { prisma } from "@/lib/prisma";
import { countVisitors, dailySeries, periodStart, topProducts, type StatEvent } from "./shop-stats";

/** Événements d'une période (plafonnés pour rester rapides sur les très grosses boutiques). */
async function events(consultantId: string, from: Date, to?: Date): Promise<StatEvent[]> {
  return prisma.shopEvent.findMany({
    where: { consultantId, createdAt: { gte: from, ...(to ? { lt: to } : {}) } },
    select: { kind: true, sid: true, productId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 60_000,
  });
}

/** Commandes en ligne attribuées à la boutique (lien du revendeur), hors commandes saisies par lui. */
async function onlineOrders(consultantId: string, from: Date, to?: Date) {
  const rows = await prisma.order.findMany({
    where: { consultantId, channel: { not: "REVENDEUR" }, status: { not: "ANNULEE" }, createdAt: { gte: from, ...(to ? { lt: to } : {}) } },
    select: { total: true },
  });
  return { count: rows.length, amount: rows.reduce((s, r) => s + r.total, 0) };
}

/** Tableau de bord de la boutique d'un revendeur sur `days` jours, avec la période précédente pour comparer. */
export async function shopStats(consultantId: string, days: number, now = new Date()) {
  const from = periodStart(days, now);
  const prevFrom = new Date(from);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - days);

  const [ev, prevEv, orders, prevOrders] = await Promise.all([
    events(consultantId, from),
    events(consultantId, prevFrom, from),
    onlineOrders(consultantId, from),
    onlineOrders(consultantId, prevFrom, from),
  ]);

  const top = topProducts(ev);
  const names = top.length
    ? new Map((await prisma.product.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]))
    : new Map<string, string>();

  return {
    visitors: countVisitors(ev),
    whatsapp: ev.filter((e) => e.kind === "whatsapp").length,
    products: ev.filter((e) => e.kind === "produit").length,
    orders,
    previous: { visitors: countVisitors(prevEv), whatsapp: prevEv.filter((e) => e.kind === "whatsapp").length, orders: prevOrders.count },
    series: dailySeries(ev, days, now),
    top: top.map(([id, clicks]) => ({ id, name: names.get(id) ?? "Produit retiré", clicks })),
  };
}

export type ShopStats = Awaited<ReturnType<typeof shopStats>>;
