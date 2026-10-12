/**
 * Résumé du soir envoyé sur le WhatsApp de l'équipe : ventes et encaissements du jour, cumul du
 * mois, commandes à livrer, paiements en attente, ruptures, revendeurs inactifs, avis à modérer,
 * changements de prix Chogan. Le texte est construit à part (pur) pour être testé.
 */
import { prisma } from "@/lib/prisma";
import { getStockRows } from "@/lib/inventory-report";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { sendWhatsApp } from "@/lib/whatsapp";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;

export interface DailyFigures {
  date: string;
  ordersToday: number;
  revenueToday: number;
  cashedToday: number;
  revenueMonth: number;
  toDeliver: number;
  unpaidOld: number;
  outOfStock: { count: number; top: string[] };
  inactiveResellers: { count: number; names: string[] };
  reviewsPending: number;
  priceChanges: number;
  origin: string;
}

export function summaryText(f: DailyFigures): string {
  const lines = [
    `*JAMAAL · résumé du ${f.date}*`,
    "",
    `🛍️ Aujourd'hui : ${f.ordersToday} commande(s), ${fcfa(f.revenueToday)}`,
    `💰 Encaissé aujourd'hui : ${fcfa(f.cashedToday)}`,
    `📈 Cumul du mois : ${fcfa(f.revenueMonth)}`,
    `🚚 À livrer : ${f.toDeliver}${f.unpaidOld ? ` · paiements en attente depuis +24 h : ${f.unpaidOld}` : ""}`,
    `📦 Ruptures : ${f.outOfStock.count}${f.outOfStock.top.length ? ` (dont vendus récemment : ${f.outOfStock.top.join(", ")})` : ""}`,
    `🧑‍🤝‍🧑 Revendeurs sans vente depuis 30 j : ${f.inactiveResellers.count}${f.inactiveResellers.names.length ? ` (${f.inactiveResellers.names.join(", ")}${f.inactiveResellers.count > f.inactiveResellers.names.length ? "…" : ""})` : ""}`,
  ];
  if (f.reviewsPending) lines.push(`⭐ Avis à valider : ${f.reviewsPending}`);
  if (f.priceChanges) lines.push(`🏷️ Prix Chogan modifiés aujourd'hui : ${f.priceChanges} (Admin > Stocks > Commande Chogan)`);
  lines.push("", `Tableau de bord : ${f.origin}/admin`);
  return lines.join("\n");
}

export async function dailyFigures(origin: string, now = new Date()): Promise<DailyFigures> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const valid = { status: { not: "ANNULEE" as const } };
  const [today, cashed, month, toDeliver, unpaidOld, rows, consultants, reviewsPending, priceChanges] = await Promise.all([
    prisma.order.aggregate({ where: { ...valid, createdAt: { gte: dayStart } }, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...valid, paymentStatus: "PAYE", paidAt: { gte: dayStart } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...valid, createdAt: { gte: monthStart } }, _sum: { total: true } }),
    prisma.order.count({ where: { status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] }, isReservation: false } }),
    prisma.order.count({ where: { ...valid, paymentStatus: "EN_ATTENTE", paymentMethod: { not: "A_LA_LIVRAISON" }, createdAt: { lt: new Date(now.getTime() - 86_400_000), gte: new Date(now.getTime() - 14 * 86_400_000) } } }),
    getStockRows(),
    prisma.consultant.findMany({ where: { active: true }, select: { name: true, orders: { where: { ...valid, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } }, select: { id: true }, take: 1 } } }),
    prisma.review.count({ where: { approved: false } }),
    prisma.choganPriceChange.count({ where: { detectedAt: { gte: dayStart } } }),
  ]);
  const out = rows.filter((r) => r.status === "rupture");
  const inactive = consultants.filter((c) => !c.orders.length);
  return {
    date: now.toLocaleDateString("fr-FR", { timeZone: "Africa/Dakar" }),
    ordersToday: today._count._all,
    revenueToday: today._sum.total ?? 0,
    cashedToday: cashed._sum.total ?? 0,
    revenueMonth: month._sum.total ?? 0,
    toDeliver,
    unpaidOld,
    outOfStock: { count: out.length, top: out.filter((r) => r.sold30 > 0).sort((a, b) => b.sold30 - a.sold30).slice(0, 5).map((r) => `${r.name}${r.format ? ` ${r.format}` : ""}`) },
    inactiveResellers: { count: inactive.length, names: inactive.slice(0, 5).map((c) => c.name) },
    reviewsPending,
    priceChanges,
    origin,
  };
}

/** Envoie le résumé une fois par jour (clé datée) ; renvoie le texte envoyé, ou la raison. */
export async function sendDailySummary(origin: string, now = new Date()): Promise<string> {
  if (!(await automationEnabled("summary"))) return "désactivé";
  if (!(await claimAutomation(`resume:${now.toISOString().slice(0, 10)}`))) return "déjà envoyé aujourd'hui";
  const text = summaryText(await dailyFigures(origin, now));
  for (const c of WHATSAPP_CONTACTS) await sendWhatsApp({ to: c.number, text, kind: "resume" });
  return text;
}
