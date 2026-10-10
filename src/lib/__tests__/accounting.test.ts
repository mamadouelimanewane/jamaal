import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POSTING, isBalanced, numberEntries, postCommissionEntry, postExpense, postOrder, postReturn, postStockVariation, postWalletTx, vatOf,
  type Entry, type OrderInput,
} from "../accounting/posting";
import { balanceSheet, cashFlowByMonth, incomeStatement, journalCheck, ledger, totalsBy, trialBalance, vatByMonth } from "../accounting/reports";
import { normalizeAccounting } from "../accounting/config";
import { parsePeriod, previousPeriod } from "../accounting/period";
import { labelFor, mergeAccounts } from "../accounting/chart";

const d = (s: string) => new Date(`${s}T10:00:00Z`);
const order = (o: Partial<OrderInput>): OrderInput => ({
  id: "ord1", customerName: "Awa", total: 50_000, deliveryFee: 2_000, status: "LIVREE", paymentMethod: "WAVE", paymentStatus: "PAYE",
  paidAt: d("2026-03-05"), deliveredAt: d("2026-03-06"), updatedAt: d("2026-03-06"), createdAt: d("2026-03-04"),
  isReservation: false, depositAmount: 0, depositPaidAt: null, cancelledAt: null, refundedAt: null, refundChannel: null, ...o,
});
const sum = (es: Entry[], acc: string) => es.flatMap((e) => e.lines).filter((l) => l.account === acc).reduce((s, l) => s + l.debit - l.credit, 0);

test("TVA comprise dans un montant TTC", () => {
  assert.equal(vatOf(11_800, 18), 1_800);
  assert.equal(vatOf(10_000, 0), 0);
});

test("commande payée par Wave : vente + encaissement, 411 soldé", () => {
  const es = postOrder(order({}), DEFAULT_POSTING);
  assert.equal(es.length, 2);
  assert.ok(es.every(isBalanced));
  assert.equal(sum(es, "701"), -48_000);
  assert.equal(sum(es, "7071"), -2_000);
  assert.equal(sum(es, "5521"), 50_000);
  assert.equal(sum(es, "411"), 0);
});

test("TVA et frais Wave appliqués", () => {
  const es = postOrder(order({}), { ...DEFAULT_POSTING, vatEnabled: true, fees: { WAVE: 1, ORANGE_MONEY: 0, STRIPE: 0 } });
  assert.ok(es.every(isBalanced));
  assert.equal(sum(es, "4431"), -(vatOf(48_000, 18) + vatOf(2_000, 18)));
  assert.equal(sum(es, "631"), 500);
  assert.equal(sum(es, "5521"), 49_500);
});

test("paiement à la livraison : constaté seulement une fois livrée, en caisse", () => {
  assert.equal(postOrder(order({ paymentMethod: "A_LA_LIVRAISON", paymentStatus: "EN_ATTENTE", status: "EXPEDIEE" }), DEFAULT_POSTING).length, 0);
  const es = postOrder(order({ paymentMethod: "A_LA_LIVRAISON", paymentStatus: "EN_ATTENTE", status: "LIVREE" }), DEFAULT_POSTING);
  assert.equal(sum(es, "571"), 50_000);
  assert.equal(sum(es, "411"), 0);
});

test("réservation : acompte en avance client, puis imputé à la vente", () => {
  const base = { isReservation: true, depositAmount: 15_000, depositPaidAt: d("2026-03-01") };
  const reserved = postOrder(order({ ...base, paymentStatus: "EN_ATTENTE", status: "CONFIRMEE" }), DEFAULT_POSTING);
  assert.equal(sum(reserved, "411"), -15_000); // avance du client
  const sold = postOrder(order({ ...base }), DEFAULT_POSTING);
  assert.ok(sold.every(isBalanced));
  assert.equal(sum(sold, "411"), 0);
  assert.equal(sum(sold, "5521"), 50_000);
});

test("commande payée puis annulée : dette envers le client, puis remboursement", () => {
  const cancelled = postOrder(order({ status: "ANNULEE" }), DEFAULT_POSTING);
  assert.equal(sum(cancelled, "701"), 0);
  assert.equal(sum(cancelled, "411"), -50_000);
  const refunded = postOrder(order({ status: "ANNULEE", refundedAt: d("2026-03-10"), refundChannel: "WAVE" }), DEFAULT_POSTING);
  assert.equal(sum(refunded, "411"), 0);
  assert.equal(sum(refunded, "5521"), 0);
  const kept = postOrder(order({ status: "ANNULEE", paymentStatus: "EN_ATTENTE", isReservation: true, depositAmount: 9_000, depositPaidAt: d("2026-03-01"), refundedAt: d("2026-03-10"), refundChannel: "CONSERVE" }), DEFAULT_POSTING);
  assert.equal(sum(kept, "758"), -9_000);
  assert.equal(sum(kept, "411"), 0);
});

test("commande payée avec le wallet : pas d'encaissement en trésorerie, le wallet est débité", () => {
  const es = postOrder(order({ paymentMethod: "WALLET" }), DEFAULT_POSTING);
  const w = postWalletTx({ id: "w1", ownerType: "CONSULTANT", ownerName: "Fatou", amount: -50_000, kind: "PAIEMENT", status: "VALIDE", provider: null, orderId: "ord1", customerName: "Awa", note: null, date: d("2026-03-05") })!;
  const all = [...es, w];
  assert.equal(sum(all, "411"), 0);
  assert.equal(sum(all, "4671"), 50_000);
  assert.equal(sum(all, "5521"), 0);
});

test("wallets : commission, annulation, retrait, dépôt, ajustement", () => {
  const w = (o: Partial<Parameters<typeof postWalletTx>[0]>) => postWalletTx({ id: "x", ownerType: "CONSULTANT", ownerName: "Fatou", amount: 0, kind: "COMMISSION", status: "VALIDE", provider: "WAVE", orderId: "o", note: null, date: d("2026-03-05"), ...o });
  const es = [w({ id: "a", amount: 9_000 }), w({ id: "b", amount: -9_000, kind: "ANNULATION" }), w({ id: "c", amount: 5_000, kind: "DEPOT" }), w({ id: "e", amount: -3_000, kind: "RETRAIT", provider: "ORANGE_MONEY" }), w({ id: "f", amount: 1_000, kind: "AJUSTEMENT" }), w({ id: "g", amount: 2_500, kind: "LIVRAISON", ownerType: "LIVREUR" })].filter((x): x is Entry => !!x);
  assert.ok(es.every(isBalanced));
  assert.equal(sum(es, "6322"), 0);
  assert.equal(sum(es, "4671"), -3_000); // 5 000 déposés − 3 000 retirés + 1 000 d'ajustement
  assert.equal(sum(es, "5521"), 5_000);
  assert.equal(sum(es, "5522"), -3_000);
  assert.equal(sum(es, "612"), 2_500);
  assert.equal(sum(es, "4672"), -2_500);
  assert.equal(w({ status: "EN_ATTENTE", kind: "RETRAIT", amount: -1000 }), null);
});

test("commission hors wallet comptée une seule fois", () => {
  assert.equal(postCommissionEntry({ id: "1", consultantName: "A", amount: 900, status: "WALLET", level: "VENTE", orderId: "o", date: d("2026-01-01") }), null);
  assert.equal(postCommissionEntry({ id: "1", consultantName: "A", amount: 900, status: "VERSE", level: "VENTE", orderId: "o", date: d("2026-01-01") })!.lines[0].debit, 900);
});

test("dépenses : payée tout de suite, à payer puis réglée, règlement fournisseur", () => {
  const base = { id: "e1", label: "Loyer mars", amount: 118_000, vatAmount: 18_000, account: "622", category: "Loyer", channel: "BANQUE", supplier: "SCI", reference: null, paid: true, paidAt: null, date: d("2026-03-01") };
  const direct = postExpense(base, { ...DEFAULT_POSTING, vatEnabled: true });
  assert.equal(direct.length, 1);
  assert.equal(sum(direct, "622"), 100_000);
  assert.equal(sum(direct, "4452"), 18_000);
  assert.equal(sum(direct, "521"), -118_000);
  const noVat = postExpense(base, DEFAULT_POSTING);
  assert.equal(sum(noVat, "622"), 118_000);
  const later = postExpense({ ...base, paidAt: d("2026-03-20") }, DEFAULT_POSTING);
  assert.equal(later.length, 2);
  assert.equal(sum(later, "401"), 0);
  const unpaid = postExpense({ ...base, paid: false }, DEFAULT_POSTING);
  assert.equal(sum(unpaid, "401"), -118_000);
  const legacy = postExpense({ ...base, account: null, category: "Achat stock" }, { ...DEFAULT_POSTING, purchaseMode: "RECEPTIONS" });
  assert.equal(sum(legacy, "401"), 118_000);
  assert.equal(sum(legacy, "601"), 0);
});

test("états : balance équilibrée, compte de résultat, bilan qui s'équilibre", () => {
  const es = numberEntries([
    ...postOrder(order({}), DEFAULT_POSTING),
    ...postOrder(order({ id: "ord2", total: 30_000, deliveryFee: 0, paymentMethod: "A_LA_LIVRAISON", paymentStatus: "EN_ATTENTE", status: "LIVREE", deliveredAt: d("2026-04-02") }), DEFAULT_POSTING),
    postReturn({ id: "r1", orderId: "ord1", amount: 5_000, date: d("2026-04-03"), customerName: "Awa", paymentMethod: "WAVE", reason: "Flacon abîmé" }, DEFAULT_POSTING)!,
    postWalletTx({ id: "w1", ownerType: "CONSULTANT", ownerName: "Fatou", amount: 9_000, kind: "COMMISSION", status: "VALIDE", provider: null, orderId: "ord1", note: null, date: d("2026-03-05") })!,
    ...postExpense({ id: "e1", label: "Achat Chogan", amount: 40_000, vatAmount: 0, account: "601", category: "Achat stock", channel: "WAVE", supplier: "Chogan", reference: null, paid: true, paidAt: null, date: d("2026-03-02") }, DEFAULT_POSTING),
    postStockVariation("2026-03", d("2026-03-31"), 10_000)!,
  ]);
  assert.equal(es[0].num, "AC-2026-00001");
  const check = journalCheck(es);
  assert.equal(check.debit, check.credit);
  assert.equal(check.unbalanced.length, 0);

  const all = { from: d("2026-01-01"), to: d("2026-12-31") };
  const tb = trialBalance(es, all);
  assert.equal(tb.reduce((s, r) => s + r.closeDebit, 0), tb.reduce((s, r) => s + r.closeCredit, 0));

  const is = incomeStatement(totalsBy(es));
  assert.equal(is.ventes, 48_000 + 30_000 - 5_000);
  assert.equal(is.margeCommerciale, 73_000 - 40_000 + 10_000);
  assert.equal(is.chiffreAffaires, 73_000 + 2_000);
  assert.equal(is.resultatNet, 43_000 + 2_000 - 9_000);

  const bs = balanceSheet(es, new Date("2026-05-01T00:00:00Z"));
  assert.equal(bs.totalActif, bs.totalPassif);
  assert.equal(bs.passif.resultat, 36_000);
  assert.equal(bs.passif.wallets, 9_000);
  assert.equal(bs.actif.stocks, 10_000);

  // Bilan de l'année suivante : le résultat passe en report à nouveau.
  const next = balanceSheet(es, new Date("2027-02-01T00:00:00Z"));
  assert.equal(next.passif.resultat, 0);
  assert.equal(next.passif.report, 36_000);
  assert.equal(next.totalActif, next.totalPassif);

  const march = { from: d("2026-03-01"), to: new Date("2026-04-01T00:00:00Z") };
  const april = { from: new Date("2026-04-01T00:00:00Z"), to: new Date("2026-05-01T00:00:00Z") };
  const l = ledger(es, "5521", april);
  assert.equal(l.opening, 50_000 - 40_000);
  assert.equal(l.closing, 5_000);
  const tbApril = trialBalance(es, april);
  const sales = tbApril.find((r) => r.account === "701")!;
  assert.equal(sales.openCredit, 48_000); // depuis le début de l'exercice
  assert.equal(sales.credit, 30_000);
  assert.ok(march.from < march.to);

  const flows = cashFlowByMonth(es, ["2026-03", "2026-04"]);
  assert.equal(flows[0].inflow, 50_000);
  assert.equal(flows[0].outflow, 40_000);
  assert.equal(flows[1].closing, 10_000 + 30_000 - 5_000);
});

test("TVA par mois", () => {
  const s = { ...DEFAULT_POSTING, vatEnabled: true };
  const es = [...postOrder(order({ total: 11_800, deliveryFee: 0 }), s), ...postExpense({ id: "e", label: "Pub", amount: 5_900, vatAmount: 900, account: "627", category: "Marketing", channel: "WAVE", supplier: null, reference: null, paid: true, paidAt: null, date: d("2026-03-08") }, s)];
  const [row] = vatByMonth(es, ["2026-03"], new Set());
  assert.equal(row.collected, 1_800);
  assert.equal(row.deductible, 900);
  assert.equal(row.due, 900);
});

test("réglages, périodes, plan comptable", () => {
  const s = normalizeAccounting({ vatEnabled: true, vatRate: 99, fees: { WAVE: "1" }, startDate: "2026-02-30x", customAccounts: [{ code: "5211", label: "Banque CBAO" }, { code: "9", label: "x" }] });
  assert.equal(s.vatRate, 18);
  assert.equal(s.fees.WAVE, 1);
  assert.equal(s.startDate, "");
  assert.equal(s.customAccounts.length, 1);
  const accounts = mergeAccounts(s.customAccounts);
  assert.equal(labelFor("5211", accounts), "Banque CBAO");
  assert.equal(labelFor("62211", accounts), "Locations et charges locatives (62211)");

  const now = new Date("2026-10-09T12:00:00Z");
  const p = parsePeriod({ p: "trimestre" }, now, new Date("2026-01-01"));
  assert.equal(p.fromStr, "2026-10-01");
  assert.equal(p.toStr, "2026-12-31");
  const custom = parsePeriod({ du: "2026-03-01", au: "2026-03-31" }, now, now);
  assert.equal(custom.to.toISOString(), "2026-04-01T00:00:00.000Z");
  const prev = previousPeriod({ from: new Date("2026-01-01T00:00:00Z"), to: new Date("2027-01-01T00:00:00Z") });
  assert.equal(prev.from.toISOString().slice(0, 10), "2025-01-01");
});
