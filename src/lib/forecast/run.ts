/**
 * Prévision de stock (serveur) : historique hebdomadaire des ventes par format, prévision, bon de commande
 * Chogan préparé, stock dormant ; alerte hebdomadaire à l'équipe quand une commande est à passer.
 */
import { prisma } from "@/lib/prisma";
import { getStockRows } from "@/lib/inventory-report";
import { getOrderedUntil } from "@/lib/reservation-orders";
import { claimAutomation } from "@/lib/automation-settings";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { forecastLine, learnUplifts, upcomingEvents, weekStart, type WeeklySales } from "./forecast";

const SETTINGS_KEY = "prevision_reglages";
export type ForecastSettings = { leadWeeks: number; coverWeeks: number };
export const DEFAULT_FORECAST_SETTINGS: ForecastSettings = { leadWeeks: 3, coverWeeks: 4 };

export async function getForecastSettings(): Promise<ForecastSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
  try {
    const v = row ? (JSON.parse(row.value) as Partial<ForecastSettings>) : {};
    const clamp = (n: unknown, d: number) => (Number.isFinite(Number(n)) ? Math.min(16, Math.max(1, Math.round(Number(n)))) : d);
    return { leadWeeks: clamp(v.leadWeeks, 3), coverWeeks: clamp(v.coverWeeks, 4) };
  } catch {
    return DEFAULT_FORECAST_SETTINGS;
  }
}
export async function setForecastSettings(s: ForecastSettings) {
  const value = JSON.stringify(s);
  await prisma.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
}

/** Ventes par semaine (unités) de chaque format sur ~14 mois, et le total du catalogue. */
async function weeklyHistory() {
  const rows = await prisma.$queryRaw<{ productId: string; variantId: string | null; w: Date; units: number }[]>`
    SELECT "productId", "variantId", date_trunc('week', "createdAt") AS w, (-sum(delta))::int AS units
    FROM "StockMovement"
    WHERE kind IN ('VENTE', 'ANNULATION') AND "createdAt" >= now() - interval '430 days'
    GROUP BY 1, 2, 3`;
  const byKey = new Map<string, WeeklySales>();
  const totals: WeeklySales = new Map();
  for (const r of rows) {
    const units = Math.max(0, Number(r.units) || 0);
    const w = weekStart(new Date(r.w)).getTime();
    const key = r.variantId ?? r.productId;
    if (!byKey.has(key)) byKey.set(key, new Map());
    byKey.get(key)!.set(w, (byKey.get(key)!.get(w) ?? 0) + units);
    totals.set(w, (totals.get(w) ?? 0) + units);
  }
  return { byKey, totals };
}

export async function buildForecast(now = new Date(), settings?: ForecastSettings) {
  const s = settings ?? (await getForecastSettings());
  const orderedUntil = await getOrderedUntil();
  const [rows, history, reservations] = await Promise.all([
    getStockRows(),
    weeklyHistory(),
    prisma.orderItem.findMany({
      where: { order: { isReservation: true, reservationStatus: "RESERVEE", status: { not: "ANNULEE" }, ...(orderedUntil ? { depositPaidAt: { gt: orderedUntil } } : {}) } },
      select: { productId: true, volumeLabel: true, quantity: true },
    }),
  ]);
  const reserved = new Map<string, number>();
  for (const r of reservations) reserved.set(`${r.productId}|${r.volumeLabel}`, (reserved.get(`${r.productId}|${r.volumeLabel}`) ?? 0) + r.quantity);
  const uplifts = learnUplifts(history.totals, now);

  const lines = rows.map((r) => {
    const f = forecastLine(history.byKey.get(r.key) ?? new Map(), r.stock, reserved.get(`${r.productId}|${r.format}`) ?? 0, now, { ...s, uplifts });
    return { ...r, reserved: reserved.get(`${r.productId}|${r.format}`) ?? 0, ...f };
  });
  const toOrder = lines.filter((l) => l.order > 0).sort((a, b) => b.order * (b.unitCost ?? 1) - a.order * (a.unitCost ?? 1));
  const dormant = lines.filter((l) => l.dormant > 0 && (l.unitCost ?? 0) > 0).sort((a, b) => b.dormant * (b.unitCost ?? 0) - a.dormant * (a.unitCost ?? 0));
  return {
    settings: s,
    uplifts,
    events: upcomingEvents(now, uplifts),
    toOrder,
    dormant,
    totals: {
      units: toOrder.reduce((x, l) => x + l.order, 0),
      cost: toOrder.reduce((x, l) => x + l.order * (l.unitCost ?? 0), 0),
      dormantValue: dormant.reduce((x, l) => x + l.dormant * (l.unitCost ?? 0), 0),
      ruptures: toOrder.filter((l) => l.stock <= 0 && l.weekly > 0).length,
    },
  };
}

/** Texte du bon de commande (à coller dans la commande Chogan). Pur. */
export function purchaseOrderText(lines: { code: string | null; productCode: string | null; order: number; name: string; format: string }[], date = new Date()) {
  return [`Commande Chogan JAMAAL (prévision) — ${date.toLocaleDateString("fr-FR")}`, ...lines.map((l) => `${l.code ?? l.productCode ?? "?"}\t${l.order}\t${l.name} (${l.format})`), `Total : ${lines.reduce((s, l) => s + l.order, 0)} article(s)`].join("\n");
}

/** Tâche quotidienne : une fois par semaine, prévient l'équipe que le bon de commande est prêt. */
export async function weeklyForecastAlert(origin: string, now = new Date()) {
  const week = weekStart(now).toISOString().slice(0, 10);
  const f = await buildForecast(now);
  if (!f.toOrder.length) return "rien à commander";
  if (!(await claimAutomation(`prevision:${week}`))) return "déjà envoyé cette semaine";
  const next = f.events[0];
  notifyTeamWhatsApp(
    [
      `📦 Bon de commande Chogan prêt : ${f.totals.units} article(s), ${f.toOrder.length} ligne(s), environ ${f.totals.cost.toLocaleString("fr-FR")} F.`,
      next ? `${next.label} dans ${next.weeks} semaine(s) : ventes attendues × ${next.uplift.toLocaleString("fr-FR")}.` : "",
      f.totals.ruptures ? `⚠️ ${f.totals.ruptures} produit(s) qui se vendent sont en rupture.` : "",
      f.totals.dormantValue > 0 ? `Stock dormant : ${f.totals.dormantValue.toLocaleString("fr-FR")} F.` : "",
      `Détail : ${origin.replace(/\/$/, "")}/admin/stocks/prevision`,
    ]
      .filter(Boolean)
      .join("\n")
  );
  return { lignes: f.toOrder.length, articles: f.totals.units };
}
