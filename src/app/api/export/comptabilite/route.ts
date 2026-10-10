import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse, type ExcelSheet } from "@/lib/excel";
import { JOURNALS, labelFor } from "@/lib/accounting/chart";
import { loadLedger } from "@/lib/accounting/ledger";
import { marginReport } from "@/lib/accounting/margins";
import { parsePeriod, previousPeriod } from "@/lib/accounting/period";
import { balanceSheet, cashFlowByMonth, incomeStatement, ledger, monthKeyOf, monthsBetween, totalsBy, trialBalance, vatByMonth } from "@/lib/accounting/reports";
import { ASSET_ROWS, INCOME_ROWS, LIABILITY_ROWS } from "@/lib/accounting/statements";
import type { Entry } from "@/lib/accounting/posting";

export const dynamic = "force-dynamic";

const d = (x: Date) => x.toLocaleDateString("fr-FR", { timeZone: "UTC" });
const ymd = (x: Date) => x.toISOString().slice(0, 10).replace(/-/g, "");

export async function GET(req: Request) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams);
  const type = sp.type ?? "liasse";
  const L = await loadLedger();
  const p = parsePeriod(sp, new Date(), L.start);
  const label = (c: string) => labelFor(c, L.accounts);
  const inP = (e: Entry) => e.date >= p.from && e.date < p.to;
  const suffix = `${p.fromStr}_${p.toStr}`;

  if (type === "fec") {
    // Fichier des écritures (format FEC, séparateur tabulation).
    const head = ["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise"];
    const clean = (s: string) => s.replace(/[\t\r\n]/g, " ");
    const lines = [head.join("\t")];
    for (const e of L.entries.filter(inP)) {
      for (const l of e.lines) {
        lines.push([e.journal, JOURNALS[e.journal] ?? e.journal, e.num ?? "", ymd(e.date), l.account, clean(label(l.account)), "", clean(l.aux ?? ""), clean(e.ref ?? e.num ?? ""), ymd(e.date), clean(e.label), String(l.debit), String(l.credit), "", "", ymd(e.date), "", "XOF"].join("\t"));
      }
    }
    return new Response(`﻿${lines.join("\r\n")}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="FEC-jamaal-${suffix}.txt"` } });
  }

  const journalSheet = (): ExcelSheet => ({
    name: "Journal",
    columns: [
      { header: "N° pièce", key: "num", width: 16 }, { header: "Date", key: "date", width: 12 }, { header: "Journal", key: "j", width: 8 },
      { header: "Libellé", key: "label", width: 40 }, { header: "Réf.", key: "ref", width: 14 }, { header: "Compte", key: "acc", width: 10 },
      { header: "Intitulé du compte", key: "accl", width: 34 }, { header: "Tiers / détail", key: "aux", width: 24 }, { header: "Débit", key: "debit", width: 14 }, { header: "Crédit", key: "credit", width: 14 },
    ],
    rows: L.entries.filter(inP).flatMap((e) => e.lines.map((l) => ({ num: e.num, date: d(e.date), j: e.journal, label: e.label, ref: e.ref ?? "", acc: l.account, accl: label(l.account), aux: [l.aux, l.label].filter(Boolean).join(" · "), debit: l.debit || null, credit: l.credit || null }))),
  });
  const balanceSheetXls = (): ExcelSheet => ({
    name: "Balance",
    columns: [
      { header: "Compte", key: "acc", width: 10 }, { header: "Intitulé", key: "label", width: 40 }, { header: "À nouveau débit", key: "od", width: 15 }, { header: "À nouveau crédit", key: "oc", width: 15 },
      { header: "Mouvements débit", key: "d", width: 15 }, { header: "Mouvements crédit", key: "c", width: 15 }, { header: "Solde débiteur", key: "sd", width: 15 }, { header: "Solde créditeur", key: "sc", width: 15 },
    ],
    rows: trialBalance(L.entries, p).map((r) => ({ acc: r.account, label: label(r.account), od: r.openDebit, oc: r.openCredit, d: r.debit, c: r.credit, sd: r.closeDebit, sc: r.closeCredit })),
  });
  const incomeSheet = (): ExcelSheet => {
    const prev = previousPeriod(p);
    const cur = incomeStatement(totalsBy(L.entries, inP));
    const before = incomeStatement(totalsBy(L.entries, (e) => e.date >= prev.from && e.date < prev.to));
    return {
      name: "Compte de résultat",
      columns: [{ header: "Réf.", key: "ref", width: 6 }, { header: "Libellé", key: "label", width: 44 }, { header: `${p.fromStr} → ${p.toStr}`, key: "n", width: 20 }, { header: "Période précédente", key: "n1", width: 20 }],
      rows: INCOME_ROWS.map((r) => ({ ref: r.ref, label: r.sub ? `   ${r.label}` : r.label, n: r.get(cur), n1: r.get(before) })),
    };
  };
  const bilanSheet = (): ExcelSheet => {
    const now = new Date();
    const at = p.to > now ? new Date(now.getTime() + 1000) : p.to;
    const b = balanceSheet(L.entries, at);
    return {
      name: "Bilan",
      columns: [{ header: "Rubrique", key: "label", width: 50 }, { header: `Au ${d(new Date(at.getTime() - 1))}`, key: "v", width: 20 }],
      rows: [{ label: "ACTIF", v: null }, ...ASSET_ROWS.map((r) => ({ label: r.label, v: r.get(b) })), { label: "", v: null }, { label: "PASSIF", v: null }, ...LIABILITY_ROWS.map((r) => ({ label: r.label, v: r.get(b) }))],
    };
  };
  const ledgerSheet = (compte?: string): ExcelSheet => {
    const accounts = compte ? [compte] : trialBalance(L.entries, p).map((r) => r.account);
    const rows: Record<string, unknown>[] = [];
    for (const a of accounts) {
      const g = ledger(L.entries, a, p);
      rows.push({ acc: a, label: `${label(a)} — solde au début`, balance: g.opening });
      for (const r of g.rows) rows.push({ acc: a, date: d(r.entry.date), num: r.entry.num, label: r.entry.label, aux: r.line.aux ?? "", debit: r.line.debit || null, credit: r.line.credit || null, balance: r.balance });
      rows.push({ acc: a, label: "Solde à la fin", debit: g.debit, credit: g.credit, balance: g.closing });
    }
    return {
      name: "Grand livre",
      columns: [{ header: "Compte", key: "acc", width: 10 }, { header: "Date", key: "date", width: 12 }, { header: "Pièce", key: "num", width: 16 }, { header: "Libellé", key: "label", width: 40 }, { header: "Tiers", key: "aux", width: 22 }, { header: "Débit", key: "debit", width: 14 }, { header: "Crédit", key: "credit", width: 14 }, { header: "Solde", key: "balance", width: 14 }],
      rows,
    };
  };
  const months = monthsBetween(monthKeyOf(p.from), monthKeyOf(new Date(p.to.getTime() - 1))).slice(-36);
  const cashSheet = (): ExcelSheet => ({
    name: "Trésorerie",
    columns: [{ header: "Mois", key: "m", width: 10 }, { header: "Entrées", key: "i", width: 15 }, { header: "Sorties", key: "o", width: 15 }, { header: "Flux net", key: "n", width: 15 }, { header: "Trésorerie fin de mois", key: "c", width: 20 }],
    rows: cashFlowByMonth(L.entries, months).map((f) => ({ m: f.month, i: f.inflow, o: f.outflow, n: f.net, c: f.closing })),
  });
  const vatSheet = (): ExcelSheet => ({
    name: "TVA",
    columns: [{ header: "Mois", key: "m", width: 10 }, { header: "Collectée", key: "c", width: 15 }, { header: "Récupérable", key: "d", width: 15 }, { header: "À payer", key: "due", width: 15 }],
    rows: vatByMonth(L.entries, months, new Set()).map((r) => ({ m: r.month, c: r.collected, d: r.deductible, due: r.due })),
  });
  const marginSheets = async (): Promise<ExcelSheet[]> => {
    const r = await marginReport(p);
    const cols = [{ header: "Élément", key: "label", width: 36 }, { header: "Détail", key: "sub", width: 14 }, { header: "Qté", key: "qty", width: 8 }, { header: "Ventes nettes", key: "revenue", width: 15 }, { header: "Coût d'achat", key: "cost", width: 15 }, { header: "Commissions", key: "commissions", width: 15 }, { header: "Marge", key: "margin", width: 15 }];
    return [
      { name: "Marges produits", columns: cols, rows: r.products },
      { name: "Marges gammes", columns: cols, rows: r.categories },
      { name: "Marges revendeurs", columns: cols, rows: r.sellers },
    ];
  };

  let sheets: ExcelSheet[];
  switch (type) {
    case "journal": sheets = [journalSheet()]; break;
    case "balance": sheets = [balanceSheetXls()]; break;
    case "resultat": sheets = [incomeSheet()]; break;
    case "bilan": sheets = [bilanSheet()]; break;
    case "grand-livre": sheets = [ledgerSheet(sp.compte?.replace(/\D/g, "") || undefined)]; break;
    case "marges": sheets = await marginSheets(); break;
    default: sheets = [incomeSheet(), bilanSheet(), balanceSheetXls(), journalSheet(), ledgerSheet(), cashSheet(), vatSheet(), ...(await marginSheets())];
  }
  return excelResponse(`jamaal-${type}-${suffix}.xlsx`, sheets);
}
