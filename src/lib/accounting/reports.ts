/**
 * États financiers calculés à partir des écritures : balance, grand livre, compte de résultat
 * (soldes intermédiaires SYSCOHADA), bilan, TVA, trésorerie. Pur.
 */
import { accountClass, CASH_ACCOUNTS, isBalanceSheetAccount } from "./chart";
import type { Entry, Line } from "./posting";

export type Totals = { debit: number; credit: number };
export type Period = { from: Date; to: Date }; // to exclu

export const inPeriod = (d: Date, p: Period) => d >= p.from && d < p.to;

/** 1er janvier (UTC) de l'exercice contenant la date. */
export const fiscalYearStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

export const monthKeyOf = (d: Date) => d.toISOString().slice(0, 7);
export function monthStart(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}
export function nextMonth(key: string) {
  const d = monthStart(key);
  return monthKeyOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}
export function monthsBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let k = fromKey; k <= toKey && out.length < 240; k = nextMonth(k)) out.push(k);
  return out;
}
export const monthLabel = (key: string, style: "long" | "short" = "long") =>
  monthStart(key).toLocaleDateString("fr-FR", { month: style, year: "numeric", timeZone: "UTC" });

function add(map: Map<string, Totals>, l: Line) {
  const t = map.get(l.account) ?? { debit: 0, credit: 0 };
  t.debit += l.debit;
  t.credit += l.credit;
  map.set(l.account, t);
}

/** Totaux par compte des écritures retenues. */
export function totalsBy(entries: Entry[], keep: (e: Entry) => boolean = () => true) {
  const map = new Map<string, Totals>();
  for (const e of entries) if (keep(e)) for (const l of e.lines) add(map, l);
  return map;
}

export const solde = (t: Totals | undefined) => (t ? t.debit - t.credit : 0);

/** Somme des soldes (débit − crédit) des comptes commençant par un des préfixes. */
export function sumPrefix(map: Map<string, Totals>, prefixes: string[], exclude: string[] = []) {
  let s = 0;
  for (const [code, t] of map) if (prefixes.some((p) => code.startsWith(p)) && !exclude.some((x) => code.startsWith(x))) s += t.debit - t.credit;
  return s;
}

// ---------- Balance ----------

export type BalanceRow = { account: string; openDebit: number; openCredit: number; debit: number; credit: number; closeDebit: number; closeCredit: number };

/**
 * Balance générale sur une période : à-nouveaux (comptes de bilan : tout l'historique ;
 * comptes de gestion : depuis le début de l'exercice), mouvements de la période, soldes.
 */
export function trialBalance(entries: Entry[], p: Period): BalanceRow[] {
  const fy = fiscalYearStart(p.from);
  const open = new Map<string, Totals>();
  const mov = new Map<string, Totals>();
  for (const e of entries) {
    if (e.date >= p.to) continue;
    for (const l of e.lines) {
      if (e.date >= p.from) add(mov, l);
      else if (isBalanceSheetAccount(l.account) || e.date >= fy) add(open, l);
    }
  }
  const codes = [...new Set([...open.keys(), ...mov.keys()])].sort();
  return codes.map((account) => {
    const o = solde(open.get(account));
    const m = mov.get(account) ?? { debit: 0, credit: 0 };
    const c = o + m.debit - m.credit;
    return { account, openDebit: Math.max(0, o), openCredit: Math.max(0, -o), debit: m.debit, credit: m.credit, closeDebit: Math.max(0, c), closeCredit: Math.max(0, -c) };
  });
}

// ---------- Grand livre ----------

export type LedgerLine = { entry: Entry; line: Line; balance: number };

export function ledger(entries: Entry[], account: string, p: Period, aux?: string) {
  const match = (l: Line) => (account.length >= 3 ? l.account === account || l.account.startsWith(account) : l.account.startsWith(account)) && (!aux || l.aux === aux);
  const fy = fiscalYearStart(p.from);
  let opening = 0;
  const rows: LedgerLine[] = [];
  for (const e of entries) {
    if (e.date >= p.to) continue;
    for (const l of e.lines) {
      if (!match(l)) continue;
      if (e.date < p.from) {
        if (isBalanceSheetAccount(l.account) || e.date >= fy) opening += l.debit - l.credit;
      } else rows.push({ entry: e, line: l, balance: 0 });
    }
  }
  let b = opening;
  for (const r of rows) {
    b += r.line.debit - r.line.credit;
    r.balance = b;
  }
  return { opening, rows, closing: b, debit: rows.reduce((s, r) => s + r.line.debit, 0), credit: rows.reduce((s, r) => s + r.line.credit, 0) };
}

/** Soldes par tiers (aux) d'un compte à une date. */
export function auxBalances(entries: Entry[], account: string, at: Date) {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.date >= at) continue;
    for (const l of e.lines) if (l.account === account) map.set(l.aux ?? "—", (map.get(l.aux ?? "—") ?? 0) + l.debit - l.credit);
  }
  return [...map.entries()].filter(([, v]) => v !== 0).map(([aux, balance]) => ({ aux, balance }));
}

// ---------- Compte de résultat (SYSCOHADA) ----------

export type IncomeStatement = ReturnType<typeof incomeStatement>;

/** Compte de résultat à partir des totaux d'une période. Montants positifs = produits ou charges selon la ligne. */
export function incomeStatement(t: Map<string, Totals>) {
  const prod = (p: string[], ex: string[] = []) => -sumPrefix(t, p, ex); // crédit − débit
  const chg = (p: string[], ex: string[] = []) => sumPrefix(t, p, ex); // débit − crédit

  const ventesBrutes = prod(["701"], ["7019"]);
  const retours = chg(["7019"]);
  const ventes = ventesBrutes - retours; // TA
  const achats = chg(["601"]); // RA
  const variation = chg(["6031"]); // RB (négatif = stock en hausse)
  const margeCommerciale = ventes - achats - variation; // XA
  const servicesVendus = prod(["706", "707"]); // TC-TD (livraison facturée)
  const chiffreAffaires = ventes + servicesVendus; // XB
  const autresProduits = prod(["75", "71", "72", "73"]); // TF-TH
  const autresAchats = chg(["60"], ["601", "6031"]); // RC-RE
  const transports = chg(["61"]); // RF
  const servicesExterieurs = chg(["62", "63"]); // RG-RH
  const commissionsReseau = chg(["6322"]);
  const impotsTaxes = chg(["64"]); // RI
  const autresCharges = chg(["65"]); // RJ
  const valeurAjoutee = margeCommerciale + servicesVendus + autresProduits - autresAchats - transports - servicesExterieurs - impotsTaxes - autresCharges; // XC
  const personnel = chg(["66"]); // RK
  const ebe = valeurAjoutee - personnel; // XD
  const reprises = prod(["78", "79"]);
  const dotations = chg(["68", "69"]);
  const resultatExploitation = ebe + reprises - dotations; // XE
  const produitsFinanciers = prod(["77"]);
  const chargesFinancieres = chg(["67"]);
  const resultatFinancier = produitsFinanciers - chargesFinancieres; // XF
  const rao = resultatExploitation + resultatFinancier; // XG
  const hao = prod(["82", "84", "86", "88"]) - chg(["81", "83", "85", "87"]); // XH
  const impot = chg(["89"]);
  const resultatNet = rao + hao - impot; // XI

  return {
    ventesBrutes, retours, ventes, achats, variation, margeCommerciale, servicesVendus, chiffreAffaires, autresProduits,
    autresAchats, transports, servicesExterieurs, commissionsReseau, impotsTaxes, autresCharges, valeurAjoutee, personnel, ebe,
    reprises, dotations, resultatExploitation, produitsFinanciers, chargesFinancieres, resultatFinancier, rao, hao, impot, resultatNet,
  };
}

/** Résultat (produits − charges) d'un ensemble de totaux. */
export function resultOf(t: Map<string, Totals>) {
  let r = 0;
  for (const [code, v] of t) if ("678".includes(accountClass(code))) r += v.credit - v.debit;
  return r;
}

// ---------- Bilan ----------

export type BalanceSheet = ReturnType<typeof balanceSheet>;

/** Bilan à une date (exclue) : soldes des comptes de bilan, résultat de l'exercice en cours. */
export function balanceSheet(entries: Entry[], at: Date) {
  const fy = fiscalYearStart(new Date(at.getTime() - 1));
  const bs = totalsBy(entries, (e) => e.date < at);
  const current = totalsBy(entries, (e) => e.date >= fy && e.date < at);
  const prior = totalsBy(entries, (e) => e.date < fy);
  const resultat = resultOf(current);
  const reportAnterieur = resultOf(prior);

  const bal = (code: string) => solde(bs.get(code));
  const accounts = [...bs.keys()].filter(isBalanceSheetAccount);
  const debitOf = (pred: (c: string) => boolean) => accounts.filter(pred).reduce((s, c) => s + Math.max(0, bal(c)), 0);
  const creditOf = (pred: (c: string) => boolean) => accounts.filter(pred).reduce((s, c) => s + Math.max(0, -bal(c)), 0);

  const immoBrut = accounts.filter((c) => c.startsWith("2") && !c.startsWith("28") && !c.startsWith("29")).reduce((s, c) => s + bal(c), 0);
  const amort = -accounts.filter((c) => c.startsWith("28") || c.startsWith("29")).reduce((s, c) => s + bal(c), 0);
  const actif = {
    immobilisations: immoBrut - amort,
    immoBrut,
    amortissements: amort,
    stocks: accounts.filter((c) => c.startsWith("3")).reduce((s, c) => s + bal(c), 0),
    fournisseursAvances: debitOf((c) => c.startsWith("40")),
    clients: debitOf((c) => c.startsWith("41")),
    autresCreances: debitOf((c) => c.startsWith("4") && !c.startsWith("40") && !c.startsWith("41")),
    tresorerie: debitOf((c) => c.startsWith("5")),
  };
  const capital = -accounts.filter((c) => c.startsWith("1") && !/^1[1-7]/.test(c)).reduce((s, c) => s + bal(c), 0);
  const report = -accounts.filter((c) => c.startsWith("11") || c.startsWith("12")).reduce((s, c) => s + bal(c), 0) + reportAnterieur;
  const passif = {
    capital,
    report,
    resultat,
    capitauxPropres: capital + report + resultat - accounts.filter((c) => c.startsWith("13") || c.startsWith("14") || c.startsWith("15")).reduce((s, c) => s + bal(c), 0),
    emprunts: -accounts.filter((c) => c.startsWith("16") || c.startsWith("17")).reduce((s, c) => s + bal(c), 0),
    fournisseurs: creditOf((c) => c.startsWith("40")),
    clientsAvances: creditOf((c) => c.startsWith("41")),
    fiscalSocial: creditOf((c) => c.startsWith("42") || c.startsWith("43") || c.startsWith("44")),
    wallets: creditOf((c) => c.startsWith("467")),
    autresDettes: creditOf((c) => c.startsWith("4") && !/^(40|41|42|43|44|467)/.test(c)),
    tresoreriePassif: creditOf((c) => c.startsWith("5")),
  };
  const totalActif = actif.immobilisations + actif.stocks + actif.fournisseursAvances + actif.clients + actif.autresCreances + actif.tresorerie;
  const totalPassif = passif.capitauxPropres + passif.emprunts + passif.fournisseurs + passif.clientsAvances + passif.fiscalSocial + passif.wallets + passif.autresDettes + passif.tresoreriePassif;
  return { actif, passif, totalActif, totalPassif, fiscalYear: fy.getUTCFullYear() };
}

// ---------- TVA ----------

export type VatRow = { month: string; collected: number; deductible: number; due: number; declared: boolean };

/** TVA par mois : collectée (4431), récupérable (4452), à payer. Les liquidations (journal OD modèle TVA) sont exclues. */
export function vatByMonth(entries: Entry[], months: string[], declaredMonths: Set<string>): VatRow[] {
  const rows = new Map(months.map((m) => [m, { month: m, collected: 0, deductible: 0, due: 0, declared: declaredMonths.has(m) }]));
  for (const e of entries) {
    if (e.id.startsWith("OD-") && e.label.startsWith("Déclaration de TVA")) continue;
    const r = rows.get(monthKeyOf(e.date));
    if (!r) continue;
    for (const l of e.lines) {
      if (l.account === "4431") r.collected += l.credit - l.debit;
      if (l.account === "4452") r.deductible += l.debit - l.credit;
    }
  }
  return [...rows.values()].map((r) => ({ ...r, due: r.collected - r.deductible }));
}

// ---------- Trésorerie ----------

export const isCash = (code: string) => code.startsWith("5") && !code.startsWith("585");

/** Solde de chaque compte de trésorerie à une date (exclue). */
export function cashBalances(entries: Entry[], at: Date, extra: string[] = []) {
  const t = totalsBy(entries, (e) => e.date < at);
  const codes = new Set<string>([...CASH_ACCOUNTS, ...extra]);
  for (const c of t.keys()) if (isCash(c)) codes.add(c);
  return [...codes].sort((a, b) => CASH_ACCOUNTS.indexOf(a as never) - CASH_ACCOUNTS.indexOf(b as never) || a.localeCompare(b)).map((account) => ({ account, balance: solde(t.get(account)) }));
}

export type CashFlowRow = { month: string; inflow: number; outflow: number; net: number; closing: number };

/** Flux de trésorerie par mois (hors virements internes entre comptes de trésorerie). */
export function cashFlowByMonth(entries: Entry[], months: string[]): CashFlowRow[] {
  if (!months.length) return [];
  const start = monthStart(months[0]);
  let closing = 0;
  const rows = new Map(months.map((m) => [m, { month: m, inflow: 0, outflow: 0, net: 0, closing: 0 }]));
  for (const e of entries) {
    const cashLines = e.lines.filter((l) => isCash(l.account));
    if (!cashLines.length) continue;
    const net = cashLines.reduce((s, l) => s + l.debit - l.credit, 0);
    if (e.date < start) {
      closing += net;
      continue;
    }
    const r = rows.get(monthKeyOf(e.date));
    if (!r) continue;
    // Virement interne : que des comptes de trésorerie (ou 585) dans l'écriture.
    if (e.lines.every((l) => isCash(l.account) || l.account.startsWith("585"))) continue;
    if (net > 0) r.inflow += net;
    else r.outflow += -net;
  }
  return months.map((m) => {
    const r = rows.get(m)!;
    r.net = r.inflow - r.outflow;
    closing += r.net;
    r.closing = closing;
    return r;
  });
}

// ---------- Contrôles ----------

export function journalCheck(entries: Entry[]) {
  let debit = 0, credit = 0;
  const unbalanced: Entry[] = [];
  for (const e of entries) {
    const d = e.lines.reduce((s, l) => s + l.debit, 0);
    const c = e.lines.reduce((s, l) => s + l.credit, 0);
    debit += d;
    credit += c;
    if (d !== c) unbalanced.push(e);
  }
  return { debit, credit, unbalanced };
}
