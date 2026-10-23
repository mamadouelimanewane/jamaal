/**
 * Santé du réseau (serveur) : données des membres et de leurs ventes, et alerte hebdomadaire aux Leaders
 * (et parrains directs) sur les membres qui décrochent.
 */
import { prisma } from "@/lib/prisma";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { sendWhatsApp } from "@/lib/whatsapp";
import { weekStart } from "@/lib/forecast/forecast";
import { alertsByManager, computeHealth, managerAlertText, type MemberSales } from "./network-health";

export async function networkHealth(now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const [members, agg, recent] = await Promise.all([
    prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, city: true, whatsapp: true, sponsorId: true, createdAt: true } }),
    prisma.order.groupBy({ by: ["consultantId"], where: { consultantId: { not: null }, status: { not: "ANNULEE" } }, _max: { createdAt: true }, _min: { createdAt: true } }),
    prisma.order.groupBy({ by: ["consultantId"], where: { consultantId: { not: null }, status: { not: "ANNULEE" }, createdAt: { gte: since30 } }, _count: { _all: true }, _sum: { total: true, deliveryFee: true } }),
  ]);
  const sales = new Map<string, MemberSales>();
  for (const a of agg) sales.set(a.consultantId!, { lastSaleAt: a._max.createdAt, firstSaleAt: a._min.createdAt, sales30: 0, revenue30: 0 });
  for (const r of recent) {
    const cur = sales.get(r.consultantId!) ?? { lastSaleAt: null, firstSaleAt: null, sales30: 0, revenue30: 0 };
    sales.set(r.consultantId!, { ...cur, sales30: r._count._all, revenue30: (r._sum.total ?? 0) - (r._sum.deliveryFee ?? 0) });
  }
  return computeHealth(members, sales, now);
}

/** Envoie à chaque Leader (et parrain direct) la liste de ses membres qui décrochent. Une fois par semaine. */
export async function alertManagers(origin: string, now = new Date(), opts: { force?: boolean } = {}) {
  if (!(await automationEnabled("alerts"))) return "désactivé";
  const h = await networkHealth(now);
  const week = weekStart(now).toISOString().slice(0, 10);
  const site = origin.replace(/\/$/, "");
  let sent = 0;
  for (const { manager, items } of alertsByManager(h.droppers)) {
    if (!manager.whatsapp) continue;
    const key = `sante:${week}:${manager.id}${opts.force ? `:${now.getTime()}` : ""}`;
    if (!(await claimAutomation(key))) continue;
    await sendWhatsApp({ to: manager.whatsapp, kind: "reseller", text: managerAlertText(manager.name, items, site, !manager.sponsorId), cta: { label: "Voir mon équipe", url: `${site}/admin/mes-filleuls` } });
    sent++;
  }
  return { decrocheurs: h.droppers.length, alertes: sent };
}
