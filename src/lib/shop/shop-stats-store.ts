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

/** Toutes les boutiques sur `days` jours (administration) : visiteurs, clics, commandes en ligne, thème. */
export async function allShopsStats(days: number, now = new Date()) {
  const from = periodStart(days, now);
  const [ev, orders, shops] = await Promise.all([
    prisma.$queryRaw<{ consultantId: string; visitors: number; whatsapp: number; products: number }[]>`
      SELECT "consultantId",
        (count(DISTINCT sid) FILTER (WHERE kind = 'visite') + count(*) FILTER (WHERE kind = 'visite' AND sid IS NULL))::int AS visitors,
        count(*) FILTER (WHERE kind = 'whatsapp')::int AS whatsapp,
        count(*) FILTER (WHERE kind = 'produit')::int AS products
      FROM "ShopEvent" WHERE "createdAt" >= ${from} GROUP BY "consultantId"`,
    prisma.order.groupBy({
      by: ["consultantId"],
      where: { consultantId: { not: null }, channel: { not: "REVENDEUR" }, status: { not: "ANNULEE" }, createdAt: { gte: from } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.consultant.findMany({ where: { active: true, slug: { not: null } }, select: { id: true, name: true, city: true, slug: true, shopTheme: true, shopPhoto: true, favorites: true } }),
  ]);
  const evBy = new Map(ev.map((r) => [r.consultantId, r]));
  const ordBy = new Map(orders.map((r) => [r.consultantId!, { count: r._count._all, amount: r._sum.total ?? 0 }]));
  const rows = shops.map((c) => {
    const e = evBy.get(c.id);
    const o = ordBy.get(c.id) ?? { count: 0, amount: 0 };
    return { id: c.id, name: c.name, city: c.city, slug: c.slug!, theme: c.shopTheme, ready: !!c.shopPhoto && c.favorites.length > 0, visitors: e?.visitors ?? 0, whatsapp: e?.whatsapp ?? 0, products: e?.products ?? 0, orders: o.count, amount: o.amount };
  });
  rows.sort((a, b) => b.visitors - a.visitors || b.orders - a.orders || a.name.localeCompare(b.name));
  const sum = (k: "visitors" | "whatsapp" | "products" | "orders" | "amount") => rows.reduce((s, r) => s + r[k], 0);
  return { rows, totals: { visitors: sum("visitors"), whatsapp: sum("whatsapp"), products: sum("products"), orders: sum("orders"), amount: sum("amount"), active: rows.filter((r) => r.visitors > 0).length } };
}
