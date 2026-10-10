"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { backWithError } from "@/lib/form-error";
import { CHANNELS, isValidAccount, labelFor, mergeAccounts, type AccountDef } from "@/lib/accounting/chart";
import { normalizeAccounting } from "@/lib/accounting/config";
import { getAccountingSettings, loadLedger, saveAccountingSettings } from "@/lib/accounting/ledger";
import { parseLines, type Line } from "@/lib/accounting/posting";
import { ledger as ledgerOf, monthKeyOf, monthStart, nextMonth, totalsBy, vatByMonth } from "@/lib/accounting/reports";

const BASE = "/admin/comptabilite";

class AccountingError extends Error {}

function refresh() {
  revalidatePath(BASE, "layout");
}

function done(path: string, message: string): never {
  refresh();
  const u = new URL(path, "http://local");
  u.searchParams.delete("erreur");
  u.searchParams.delete("modifier");
  u.searchParams.set("ok", message);
  redirect(`${u.pathname}?${u.searchParams.toString()}`);
}

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const money = (fd: FormData, k: string) => {
  const raw = String(fd.get(k) ?? "").replace(/[\s .]/g, "").replace(",", ".");
  if (!raw) return 0;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) throw new AccountingError("Montant invalide.");
  return n;
};
function dateOf(fd: FormData, k: string, required = true): Date | null {
  const v = str(fd, k, 10);
  if (!v) {
    if (required) throw new AccountingError("Indiquez la date.");
    return null;
  }
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(v)) throw new AccountingError("Date invalide.");
  return d;
}

/** Refuse toute saisie datée d'un mois clôturé. */
async function assertOpen(...dates: (Date | null | undefined)[]) {
  for (const d of dates) {
    if (!d) continue;
    const m = monthKeyOf(d);
    if (await prisma.accountingPeriod.findUnique({ where: { month: m }, select: { month: true } })) {
      throw new AccountingError(`Le mois ${m} est clôturé : rouvrez-le (Comptabilité › Clôtures) ou datez l'opération d'un mois ouvert.`);
    }
  }
}

// ---------- Dépenses ----------

const MAX_RECEIPT = 3 * 1024 * 1024;

export async function saveExpenseAction(fd: FormData) {
  try {
    const session = await requireAdmin();
    const id = str(fd, "id", 40);
    const label = str(fd, "label", 160);
    if (label.length < 2) throw new AccountingError("Indiquez le libellé de la dépense.");
    const amount = money(fd, "amount");
    if (amount <= 0) throw new AccountingError("Le montant doit être positif.");
    const vatAmount = money(fd, "vatAmount");
    if (vatAmount < 0 || vatAmount >= amount) throw new AccountingError("La TVA doit être inférieure au montant TTC.");
    const account = str(fd, "account", 8);
    if (!isValidAccount(account)) throw new AccountingError("Choisissez le compte de la dépense.");
    const channel = str(fd, "channel", 20);
    if (!CHANNELS[channel]) throw new AccountingError("Choisissez le moyen de paiement.");
    const date = dateOf(fd, "date")!;
    const paid = fd.get("paid") === "on";
    const paidAt = paid ? (dateOf(fd, "paidAt", false) ?? date) : null;
    if (paidAt && paidAt < date) throw new AccountingError("La date de paiement ne peut pas précéder la date de la dépense.");
    const dueDate = paid ? null : dateOf(fd, "dueDate", false);
    const accounts = mergeAccounts((await getAccountingSettings()).customAccounts);

    const file = fd.get("receipt");
    let receipt: { receipt: Uint8Array<ArrayBuffer>; receiptMime: string; receiptName: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_RECEIPT) throw new AccountingError("Justificatif trop lourd (3 Mo maximum) : prenez une photo moins grande.");
      if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(file.type)) throw new AccountingError("Justificatif : photo (JPG, PNG) ou PDF.");
      receipt = { receipt: new Uint8Array(await file.arrayBuffer()), receiptMime: file.type, receiptName: file.name.slice(0, 120) };
    }

    const data = {
      label,
      amount,
      vatAmount,
      account,
      category: labelFor(account, accounts).slice(0, 60),
      channel,
      supplier: str(fd, "supplier", 80) || null,
      reference: str(fd, "reference", 60) || null,
      note: str(fd, "note", 500) || null,
      date,
      paid,
      paidAt,
      dueDate,
      ...(receipt ?? {}),
      ...(fd.get("removeReceipt") === "on" && !receipt ? { receipt: null, receiptMime: null, receiptName: null } : {}),
    };
    if (id) {
      const old = await prisma.expense.findUnique({ where: { id }, select: { date: true, paidAt: true } });
      if (!old) throw new AccountingError("Dépense introuvable.");
      await assertOpen(old.date, old.paidAt, date, paidAt);
      await prisma.expense.update({ where: { id }, data });
      await logActivity(session, `Dépense modifiée : ${label} (${amount} F)`, "Expense", id);
    } else {
      await assertOpen(date, paidAt);
      const e = await prisma.expense.create({ data: { ...data, createdBy: session.user?.id ?? null } });
      await logActivity(session, `Dépense : ${label} (${amount} F)`, "Expense", e.id);
    }
  } catch (e) {
    await backWithError(e, `${BASE}/depenses`);
  }
  done(`${BASE}/depenses`, "Dépense enregistrée.");
}

export async function deleteExpenseAction(id: string) {
  try {
    const session = await requireAdmin();
    const old = await prisma.expense.findUnique({ where: { id }, select: { date: true, paidAt: true, label: true, amount: true } });
    if (!old) throw new AccountingError("Dépense introuvable.");
    await assertOpen(old.date, old.paidAt);
    await prisma.expense.delete({ where: { id } });
    await logActivity(session, `Dépense supprimée : ${old.label} (${old.amount} F)`, "Expense", id);
  } catch (e) {
    await backWithError(e, `${BASE}/depenses`);
  }
  done(`${BASE}/depenses`, "Dépense supprimée.");
}

export async function payExpenseAction(fd: FormData) {
  try {
    const session = await requireAdmin();
    const id = str(fd, "id", 40);
    const channel = str(fd, "channel", 20);
    if (!CHANNELS[channel]) throw new AccountingError("Choisissez le moyen de paiement.");
    const paidAt = dateOf(fd, "paidAt")!;
    await assertOpen(paidAt);
    const res = await prisma.expense.updateMany({ where: { id, paid: false }, data: { paid: true, paidAt, channel, dueDate: null } });
    if (!res.count) throw new AccountingError("Cette facture est déjà réglée.");
    await logActivity(session, "Facture fournisseur réglée", "Expense", id);
  } catch (e) {
    await backWithError(e, `${BASE}/depenses`);
  }
  done(`${BASE}/depenses`, "Règlement enregistré.");
}

// ---------- Écritures manuelles ----------

export async function saveManualEntryAction(fd: FormData) {
  let id = str(fd, "id", 40);
  try {
    const session = await requireAdmin();
    const date = dateOf(fd, "date")!;
    const label = str(fd, "label", 160);
    if (label.length < 2) throw new AccountingError("Indiquez le libellé de l'écriture.");
    const journal = ["OD", "AN", "BQ", "AC", "VE", "RE", "ST"].includes(str(fd, "journal", 4)) ? str(fd, "journal", 4) : "OD";
    let raw: unknown = [];
    try {
      raw = JSON.parse(String(fd.get("lines") ?? "[]"));
    } catch {
      throw new AccountingError("Lignes de l'écriture illisibles.");
    }
    const lines = parseLines(raw);
    if (lines.length < 2) throw new AccountingError("Une écriture a au moins deux lignes (un débit et un crédit).");
    for (const l of lines) {
      if (!isValidAccount(l.account)) throw new AccountingError(`Compte « ${l.account} » invalide (classe 1 à 8, ex. 571, 6322).`);
      if (l.debit && l.credit) throw new AccountingError(`Compte ${l.account} : une ligne est soit au débit, soit au crédit.`);
    }
    const d = lines.reduce((s, l) => s + l.debit, 0);
    const c = lines.reduce((s, l) => s + l.credit, 0);
    if (d !== c) throw new AccountingError(`Écriture déséquilibrée : débit ${d.toLocaleString("fr-FR")} F, crédit ${c.toLocaleString("fr-FR")} F.`);
    const data = { date, journal, label, reference: str(fd, "reference", 60) || null, template: str(fd, "template", 20) || null, lines: lines as unknown as object };
    if (id) {
      const old = await prisma.journalEntry.findUnique({ where: { id }, select: { date: true } });
      if (!old) throw new AccountingError("Écriture introuvable.");
      await assertOpen(old.date, date);
      await prisma.journalEntry.update({ where: { id }, data });
    } else {
      await assertOpen(date);
      id = (await prisma.journalEntry.create({ data: { ...data, createdBy: session.user?.id ?? null } })).id;
    }
    await logActivity(session, `Écriture comptable : ${label} (${d} F)`, "JournalEntry", id);
  } catch (e) {
    await backWithError(e, `${BASE}/journal/saisie`);
  }
  done(`${BASE}/journal`, "Écriture enregistrée.");
}

export async function deleteManualEntryAction(id: string) {
  try {
    const session = await requireAdmin();
    const old = await prisma.journalEntry.findUnique({ where: { id }, select: { date: true, label: true } });
    if (!old) throw new AccountingError("Écriture introuvable.");
    await assertOpen(old.date);
    await prisma.journalEntry.delete({ where: { id } });
    await logActivity(session, `Écriture supprimée : ${old.label}`, "JournalEntry", id);
  } catch (e) {
    await backWithError(e, `${BASE}/journal`);
  }
  done(`${BASE}/journal`, "Écriture supprimée.");
}

// ---------- TVA ----------

/** Liquidation de la TVA d'un mois : solde 4431 et 4452 vers 4441 (à payer) ou 4449 (crédit). */
export async function declareVatAction(fd: FormData) {
  const month = str(fd, "month", 7);
  try {
    const session = await requireAdmin();
    if (!/^\d{4}-\d{2}$/.test(month)) throw new AccountingError("Mois invalide.");
    const { entries } = await loadLedger();
    const existing = await prisma.journalEntry.findFirst({ where: { template: "TVA", reference: `TVA-${month}` } });
    if (existing) throw new AccountingError(`La TVA de ${month} est déjà déclarée.`);
    const [row] = vatByMonth(entries, [month], new Set());
    if (!row.collected && !row.deductible) throw new AccountingError("Aucune TVA sur ce mois.");
    const date = new Date(monthStart(nextMonth(month)).getTime() - 1000);
    await assertOpen(date);
    const lines: Line[] = [
      { account: "4431", debit: Math.max(0, row.collected), credit: Math.max(0, -row.collected) },
      { account: "4452", debit: Math.max(0, -row.deductible), credit: Math.max(0, row.deductible) },
      row.due >= 0 ? { account: "4441", debit: 0, credit: row.due } : { account: "4449", debit: -row.due, credit: 0 },
    ].filter((l) => l.debit || l.credit);
    await prisma.journalEntry.create({ data: { date, journal: "OD", label: `Déclaration de TVA ${month}`, reference: `TVA-${month}`, template: "TVA", lines: lines as unknown as object, createdBy: session.user?.id ?? null } });
    await logActivity(session, `Déclaration de TVA ${month} : ${row.due} F`, "JournalEntry");
  } catch (e) {
    await backWithError(e, `${BASE}/tva`);
  }
  done(`${BASE}/tva`, `TVA de ${month} déclarée. Enregistrez le paiement en dépense (compte 4441) quand il est fait.`);
}

// ---------- Budgets ----------

export async function saveBudgetsAction(fd: FormData) {
  const month = str(fd, "month", 7);
  try {
    const session = await requireAdmin();
    if (!/^\d{4}-\d{2}$/.test(month)) throw new AccountingError("Mois invalide.");
    const values: { account: string; amount: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("b_")) continue;
      const account = k.slice(2);
      if (!isValidAccount(account)) continue;
      const amount = Math.round(Number(String(v).replace(/[\s .]/g, "").replace(",", ".")) || 0);
      values.push({ account, amount: Math.max(0, amount) });
    }
    const targets = fd.get("year") === "on" ? Array.from({ length: 12 }, (_, i) => `${month.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`).filter((m) => m >= month) : [month];
    for (const m of targets) {
      for (const v of values) {
        if (v.amount > 0) await prisma.budget.upsert({ where: { month_account: { month: m, account: v.account } }, update: { amount: v.amount }, create: { month: m, account: v.account, amount: v.amount } });
        else await prisma.budget.deleteMany({ where: { month: m, account: v.account } });
      }
    }
    await logActivity(session, `Budget ${month}${targets.length > 1 ? " (reporté jusqu'à décembre)" : ""}`, "Budget");
  } catch (e) {
    await backWithError(e, `${BASE}/budgets`);
  }
  done(`${BASE}/budgets?mois=${month}`, "Budget enregistré.");
}

// ---------- Clôtures ----------

export async function closeMonthAction(fd: FormData) {
  const month = str(fd, "month", 7);
  try {
    const session = await requireAdmin();
    if (!/^\d{4}-\d{2}$/.test(month)) throw new AccountingError("Mois invalide.");
    if (month >= monthKeyOf(new Date())) throw new AccountingError("On ne clôture qu'un mois terminé.");
    const { entries } = await loadLedger();
    const from = monthStart(month);
    const to = monthStart(nextMonth(month));
    const t = totalsBy(entries, (e) => e.date >= from && e.date < to);
    const snapshot = {
      entries: entries.filter((e) => e.date >= from && e.date < to).length,
      totals: Object.fromEntries([...t].map(([k, v]) => [k, [v.debit, v.credit]])),
    };
    await prisma.accountingPeriod.upsert({ where: { month }, update: { snapshot, closedAt: new Date(), closedBy: session.user?.id ?? null, note: str(fd, "note", 300) || null }, create: { month, snapshot, closedBy: session.user?.id ?? null, note: str(fd, "note", 300) || null } });
    await logActivity(session, `Clôture comptable de ${month}`, "AccountingPeriod", month);
  } catch (e) {
    await backWithError(e, `${BASE}/clotures`);
  }
  done(`${BASE}/clotures`, `Mois ${month} clôturé : plus aucune saisie datée de ce mois.`);
}

export async function reopenMonthAction(month: string) {
  try {
    const session = await requireAdmin();
    await prisma.accountingPeriod.delete({ where: { month } });
    await logActivity(session, `Réouverture comptable de ${month}`, "AccountingPeriod", month);
  } catch (e) {
    await backWithError(e, `${BASE}/clotures`);
  }
  done(`${BASE}/clotures`, `Mois ${month} rouvert.`);
}

// ---------- Trésorerie ----------

/** Comptage de caisse / rapprochement : compare le solde réel au solde comptable, constate l'écart si demandé. */
export async function saveCashCountAction(fd: FormData) {
  let msg = "";
  try {
    const session = await requireAdmin();
    const account = str(fd, "account", 8);
    if (!/^5\d+$/.test(account)) throw new AccountingError("Choisissez un compte de trésorerie.");
    const date = dateOf(fd, "date")!;
    const counted = money(fd, "counted");
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
    const { entries } = await loadLedger();
    const theoretical = ledgerOf(entries, account, { from: end, to: end }).opening;
    const gap = counted - theoretical;
    const note = str(fd, "note", 300) || null;
    await prisma.cashCount.create({ data: { account, date, counted, theoretical, note, createdBy: session.user?.id ?? null } });
    if (gap !== 0 && fd.get("adjust") === "on") {
      await assertOpen(date);
      const lines: Line[] = gap > 0 ? [{ account, debit: gap, credit: 0 }, { account: "758", debit: 0, credit: gap }] : [{ account: "658", debit: -gap, credit: 0 }, { account, debit: 0, credit: -gap }];
      await prisma.journalEntry.create({ data: { date, journal: "OD", label: `Écart de ${gap > 0 ? "caisse positif" : "caisse négatif"} constaté (${account})`, template: "ECART", lines: lines as unknown as object, createdBy: session.user?.id ?? null } });
    }
    msg = gap === 0 ? "Comptage enregistré : aucun écart, la comptabilité est juste." : `Comptage enregistré : écart de ${gap.toLocaleString("fr-FR")} F${fd.get("adjust") === "on" ? ", constaté en comptabilité" : ""}.`;
    await logActivity(session, `Comptage ${account} : ${counted} F (écart ${gap} F)`, "CashCount");
  } catch (e) {
    await backWithError(e, `${BASE}/tresorerie`);
  }
  done(`${BASE}/tresorerie`, msg);
}

/** Commande annulée déjà encaissée : remboursement fait au client, ou acompte conservé. */
export async function markOrderRefundedAction(fd: FormData) {
  try {
    const session = await requireAdmin();
    const orderId = str(fd, "orderId", 40);
    const channel = str(fd, "channel", 20);
    if (!CHANNELS[channel] && channel !== "CONSERVE") throw new AccountingError("Choisissez comment le client a été remboursé.");
    const date = dateOf(fd, "date")!;
    await assertOpen(date);
    const res = await prisma.order.updateMany({ where: { id: orderId, status: "ANNULEE", refundedAt: null }, data: { refundedAt: date, refundChannel: channel, refundNote: str(fd, "note", 300) || null } });
    if (!res.count) throw new AccountingError("Commande introuvable ou déjà traitée.");
    await logActivity(session, channel === "CONSERVE" ? "Acompte conservé" : `Commande remboursée (${CHANNELS[channel].label})`, "Order", orderId);
  } catch (e) {
    await backWithError(e, `${BASE}/tresorerie`);
  }
  done(`${BASE}/tresorerie`, "Remboursement enregistré.");
}

// ---------- Réglages ----------

export async function saveAccountingSettingsAction(fd: FormData) {
  try {
    const session = await requireAdmin();
    const current = await getAccountingSettings();
    const next = normalizeAccounting({
      ...current,
      vatEnabled: fd.get("vatEnabled") === "on",
      vatRate: Number(fd.get("vatRate")),
      fees: { WAVE: fd.get("feeWave"), ORANGE_MONEY: fd.get("feeOm"), STRIPE: fd.get("feeStripe") },
      purchaseMode: fd.get("purchaseMode"),
      startDate: str(fd, "startDate", 10),
      company: { name: str(fd, "name"), ninea: str(fd, "ninea"), rccm: str(fd, "rccm"), address: str(fd, "address"), regime: str(fd, "regime") },
    });
    if (str(fd, "startDate", 10) && !next.startDate) throw new AccountingError("Date de début invalide.");
    await saveAccountingSettings(next);
    await logActivity(session, "Réglages comptables modifiés", "Setting", "accounting_settings");
  } catch (e) {
    await backWithError(e, `${BASE}/reglages`);
  }
  done(`${BASE}/reglages`, "Réglages enregistrés.");
}

export async function addAccountAction(fd: FormData) {
  try {
    const session = await requireAdmin();
    const code = str(fd, "code", 8);
    const label = str(fd, "label", 80);
    if (!isValidAccount(code) || code.length < 3) throw new AccountingError("Numéro de compte : 3 à 8 chiffres, classe 1 à 8 (ex. 5211 pour une deuxième banque).");
    if (label.length < 2) throw new AccountingError("Indiquez l'intitulé du compte.");
    const s = await getAccountingSettings();
    const custom: AccountDef[] = [...s.customAccounts.filter((a) => a.code !== code), { code, label }];
    await saveAccountingSettings({ ...s, customAccounts: custom });
    await logActivity(session, `Compte ${code} « ${label} »`, "Setting", "accounting_settings");
  } catch (e) {
    await backWithError(e, `${BASE}/reglages`);
  }
  done(`${BASE}/reglages`, "Compte enregistré.");
}

export async function removeAccountAction(code: string) {
  try {
    await requireAdmin();
    const s = await getAccountingSettings();
    await saveAccountingSettings({ ...s, customAccounts: s.customAccounts.filter((a) => a.code !== code) });
  } catch (e) {
    await backWithError(e, `${BASE}/reglages`);
  }
  done(`${BASE}/reglages`, "Compte retiré (le libellé par défaut s'applique).");
}
