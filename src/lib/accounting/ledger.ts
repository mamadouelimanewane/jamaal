/**
 * Chargement du grand livre : lit toutes les opérations de la base et génère les écritures.
 * Mis en cache le temps d'une requête (plusieurs états sur une même page). Fichier serveur.
 */
import { cache } from "react";
import { prisma } from "../prisma";
import { getBusinessModel } from "../business-model-store";
import { getStockRows } from "../inventory-report";
import { mergeAccounts, type AccountDef } from "./chart";
import { DEFAULT_ACCOUNTING, normalizeAccounting, type AccountingSettings } from "./config";
import {
  numberEntries, parseLines, postCommissionEntry, postCommissionPayment, postExpense, postLivreurEarning, postManual, postOpeningStock,
  postOrder, postReception, postReturn, postStockVariation, postWalletTx, type Entry,
} from "./posting";
import { monthKeyOf, monthStart, monthsBetween, nextMonth } from "./reports";

const SETTING_KEY = "accounting_settings";

export async function getAccountingSettings(): Promise<AccountingSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return DEFAULT_ACCOUNTING;
  try {
    return normalizeAccounting(JSON.parse(row.value));
  } catch {
    return DEFAULT_ACCOUNTING;
  }
}

export async function saveAccountingSettings(s: AccountingSettings) {
  const value = JSON.stringify(normalizeAccounting(s));
  await prisma.setting.upsert({ where: { key: SETTING_KEY }, update: { value }, create: { key: SETTING_KEY, value } });
}

export async function getAccounts(): Promise<AccountDef[]> {
  return mergeAccounts((await getAccountingSettings()).customAccounts);
}

/** Début effectif de la comptabilité : réglage, sinon 1er jour du mois de la première opération. */
async function effectiveStart(s: AccountingSettings): Promise<Date> {
  if (s.startDate) return new Date(`${s.startDate}T00:00:00.000Z`);
  const [o, e, m] = await Promise.all([
    prisma.order.aggregate({ _min: { createdAt: true } }),
    prisma.expense.aggregate({ _min: { date: true } }),
    prisma.stockMovement.aggregate({ _min: { createdAt: true } }),
  ]);
  const dates = [o._min.createdAt, e._min.date, m._min.createdAt].filter((d): d is Date => !!d);
  const first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
  return monthStart(monthKeyOf(first));
}

type StockValuation = { opening: number; months: { month: string; date: Date; variation: number; end: number }[]; current: number; estimated: number; receptions: { id: string; date: Date; quantity: number; unitCost: number; label: string; reference: string | null }[] };

/** Valeur du stock (prix d'achat) au début de la comptabilité et à chaque fin de mois, reconstituée depuis les mouvements. */
async function stockValuation(start: Date): Promise<StockValuation> {
  const [rows, model] = await Promise.all([getStockRows(), getBusinessModel()]);
  let estimated = 0;
  const unit = new Map<string, { stock: number; cost: number; label: string }>();
  for (const r of rows) {
    let cost = r.unitCost;
    if (cost == null && r.salePrice && model.salePct > 0) {
      cost = Math.round((r.salePrice * model.purchasePct) / model.salePct);
      estimated++;
    }
    unit.set(`${r.productId}:${r.variantId ?? ""}`, { stock: r.stock, cost: cost ?? 0, label: `${r.name} ${r.format}` });
  }
  const startKey = monthKeyOf(start);
  const [byMonth, sinceStart, receptions] = await Promise.all([
    prisma.$queryRaw<{ productId: string; variantId: string | null; m: string; d: number }[]>`
      SELECT "productId", "variantId", to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS m, SUM("delta")::int AS d
      FROM "StockMovement" WHERE "createdAt" >= ${monthStart(startKey)} GROUP BY 1, 2, 3`,
    prisma.stockMovement.groupBy({ by: ["productId", "variantId"], where: { createdAt: { gte: start } }, _sum: { delta: true } }),
    prisma.stockMovement.findMany({ where: { kind: "RECEPTION", delta: { gt: 0 }, createdAt: { gte: start } }, select: { id: true, productId: true, variantId: true, delta: true, createdAt: true, reference: true } }),
  ]);
  const valueWith = (deltaAfter: Map<string, number>) => {
    let v = 0;
    for (const [k, u] of unit) v += Math.max(0, u.stock - (deltaAfter.get(k) ?? 0)) * u.cost;
    return v;
  };
  const current = valueWith(new Map());
  const opening = valueWith(new Map(sinceStart.map((r) => [`${r.productId}:${r.variantId ?? ""}`, r._sum.delta ?? 0])));
  const nowKey = monthKeyOf(new Date());
  const months = monthsBetween(startKey, nowKey);
  // Mouvements cumulés à partir de chaque mois (du plus récent au plus ancien).
  const perMonth = new Map<string, Map<string, number>>();
  for (const r of byMonth) {
    const m = perMonth.get(r.m) ?? new Map<string, number>();
    m.set(`${r.productId}:${r.variantId ?? ""}`, (m.get(`${r.productId}:${r.variantId ?? ""}`) ?? 0) + Number(r.d));
    perMonth.set(r.m, m);
  }
  const ends = new Map<string, number>();
  const acc = new Map<string, number>();
  for (let i = months.length - 1; i >= 0; i--) {
    ends.set(months[i], valueWith(acc)); // valeur à la fin du mois i = actuelle − mouvements des mois suivants
    for (const [k, d] of perMonth.get(months[i]) ?? []) acc.set(k, (acc.get(k) ?? 0) + d);
  }
  const now = new Date();
  let prev = opening;
  const out = months.map((m) => {
    const end = ends.get(m) ?? prev;
    const endDate = new Date(monthStart(nextMonth(m)).getTime() - 1000);
    const row = { month: m, date: endDate > now ? now : endDate, variation: end - prev, end };
    prev = end;
    return row;
  });
  return {
    opening,
    months: out,
    current,
    estimated,
    receptions: receptions.map((r) => {
      const u = unit.get(`${r.productId}:${r.variantId ?? ""}`);
      return { id: r.id, date: r.createdAt, quantity: r.delta, unitCost: u?.cost ?? 0, label: u?.label ?? "marchandises", reference: r.reference };
    }),
  };
}

export type Ledger = Awaited<ReturnType<typeof buildLedger>>;

async function buildLedger() {
  const settings = await getAccountingSettings();
  const start = await effectiveStart(settings);
  const [orders, returns, walletTx, commissions, earnings, payments, expenses, manuals, consultants, livreurs, periods, stock] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ status: { not: "ANNULEE" } }, { paymentStatus: "PAYE" }, { depositPaidAt: { not: null } }] },
      select: {
        id: true, customerName: true, total: true, deliveryFee: true, status: true, paymentMethod: true, paymentStatus: true, paidAt: true,
        deliveredAt: true, updatedAt: true, createdAt: true, isReservation: true, depositAmount: true, depositPaidAt: true, refundedAt: true, refundChannel: true,
      },
    }),
    prisma.return.findMany({ where: { status: "REMBOURSE" }, select: { id: true, orderId: true, amount: true, reason: true, processedAt: true, createdAt: true, order: { select: { customerName: true, paymentMethod: true } } } }),
    prisma.walletTransaction.findMany({ where: { status: "VALIDE" }, select: { id: true, ownerType: true, ownerId: true, amount: true, kind: true, status: true, provider: true, orderId: true, note: true, createdAt: true, updatedAt: true } }),
    prisma.commissionEntry.findMany({ where: { status: { notIn: ["ANNULE", "WALLET"] } }, select: { id: true, amount: true, status: true, level: true, orderId: true, createdAt: true, consultant: { select: { name: true } } } }),
    prisma.livreurEarning.findMany({ where: { status: { notIn: ["ANNULE", "WALLET"] } }, select: { id: true, amount: true, status: true, provider: true, orderId: true, createdAt: true, updatedAt: true, livreur: { select: { name: true } } } }),
    prisma.commissionPayment.findMany({ select: { id: true, amount: true, periodLabel: true, note: true, paidAt: true, consultant: { select: { name: true } } } }),
    prisma.expense.findMany({ select: { id: true, label: true, amount: true, vatAmount: true, account: true, category: true, channel: true, supplier: true, reference: true, paid: true, paidAt: true, date: true } }),
    prisma.journalEntry.findMany({ orderBy: { date: "asc" } }),
    prisma.consultant.findMany({ select: { id: true, name: true } }),
    prisma.livreur.findMany({ select: { id: true, name: true } }),
    prisma.accountingPeriod.findMany({ orderBy: { month: "asc" } }),
    stockValuation(start),
  ]);
  const names = new Map<string, string>([...consultants.map((c) => [`CONSULTANT:${c.id}`, c.name] as const), ...livreurs.map((l) => [`LIVREUR:${l.id}`, l.name] as const)]);
  const customerOf = new Map(orders.map((o) => [o.id, o.customerName]));

  const generated: Entry[] = [];
  for (const o of orders) generated.push(...postOrder({ ...o, cancelledAt: null }, settings));
  for (const r of returns) {
    const e = postReturn({ id: r.id, orderId: r.orderId, amount: r.amount, reason: r.reason, date: r.processedAt ?? r.createdAt, customerName: r.order.customerName, paymentMethod: r.order.paymentMethod }, settings);
    if (e) generated.push(e);
  }
  for (const t of walletTx) {
    const e = postWalletTx({ ...t, date: t.kind === "RETRAIT" || t.kind === "DEPOT" ? t.updatedAt : t.createdAt, ownerName: names.get(`${t.ownerType}:${t.ownerId}`) ?? "Membre", customerName: t.orderId ? customerOf.get(t.orderId) : null });
    if (e) generated.push(e);
  }
  for (const c of commissions) {
    const e = postCommissionEntry({ id: c.id, amount: c.amount, status: c.status, level: c.level, orderId: c.orderId, date: c.createdAt, consultantName: c.consultant.name });
    if (e) generated.push(e);
  }
  for (const l of earnings) generated.push(...postLivreurEarning({ ...l, livreurName: l.livreur.name }));
  for (const p of payments) {
    const e = postCommissionPayment({ id: p.id, amount: p.amount, label: p.periodLabel, note: p.note, date: p.paidAt, consultantName: p.consultant.name });
    if (e) generated.push(e);
  }
  for (const x of expenses) generated.push(...postExpense(x, settings));
  if (settings.purchaseMode === "RECEPTIONS") {
    for (const r of stock.receptions) {
      const e = postReception(r);
      if (e) generated.push(e);
    }
  }
  const opening = postOpeningStock(start, stock.opening);
  if (opening) generated.push(opening);
  for (const m of stock.months) {
    const e = postStockVariation(m.month, m.date, m.variation);
    if (e) generated.push(e);
  }

  const kept = generated.filter((e) => e.date >= start);
  const manual = manuals.map((m) => postManual({ id: m.id, date: m.date, journal: m.journal, label: m.label, reference: m.reference, lines: parseLines(m.lines) })).filter((e): e is Entry => !!e);
  const entries = numberEntries([...kept, ...manual]);
  return {
    entries,
    settings,
    accounts: mergeAccounts(settings.customAccounts),
    start,
    periods,
    closedMonths: new Set(periods.map((p) => p.month)),
    stock: { current: stock.current, opening: stock.opening, estimated: stock.estimated },
    /** Réceptions de stock valorisées au prix d'achat (contrôle des achats saisis). */
    receptions: stock.receptions.map((r) => ({ date: r.date, value: Math.round(r.quantity * r.unitCost) })),
    ignoredBeforeStart: generated.length - kept.length,
  };
}

/** Grand livre complet (une fois par requête). */
export const loadLedger = cache(buildLedger);
