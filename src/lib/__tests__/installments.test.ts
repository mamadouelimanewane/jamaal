import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInstallments, offeredCounts, splitAmounts, dueDates, schedule, nextInstallment, planLabel, reminderText, DEFAULT_INSTALLMENTS } from "../installments";
import { amountDue } from "../reservation";

test("paiement en plusieurs fois : réglages normalisés et offre", () => {
  assert.deepEqual(normalizeInstallments(null), DEFAULT_INSTALLMENTS);
  const s = normalizeInstallments({ enabled: true, minTotal: 20000, maxParts: 2, intervalDays: 3 });
  assert.equal(s.maxParts, 2);
  assert.equal(s.intervalDays, 15);
  assert.deepEqual(offeredCounts(19999, s), []);
  assert.deepEqual(offeredCounts(20000, s), [2]);
  assert.deepEqual(offeredCounts(50000, DEFAULT_INSTALLMENTS), [2, 3]);
  assert.deepEqual(offeredCounts(50000, { ...DEFAULT_INSTALLMENTS, enabled: false }), []);
});

test("paiement en plusieurs fois : montants exacts et dates", () => {
  assert.deepEqual(splitAmounts(30000, 3), [10000, 10000, 10000]);
  assert.deepEqual(splitAmounts(31750, 3), [10750, 10500, 10500]);
  assert.equal(splitAmounts(31750, 3).reduce((a, b) => a + b, 0), 31750);
  assert.deepEqual(splitAmounts(17300, 2), [8700, 8600]);
  const d = dueDates(new Date("2026-10-29T10:00:00Z"), 3, 15);
  assert.deepEqual(d.map((x) => x.toISOString().slice(0, 10)), ["2026-10-29", "2026-11-13", "2026-11-28"]);
  assert.equal(planLabel(30000, 3), "3 × 10 000 F CFA");
  assert.equal(planLabel(49900, 2), "25 000 F CFA puis 24 900 F CFA");
  assert.equal(planLabel(31750, 3), "10 750 F CFA puis 2 × 10 500 F CFA");
});

test("paiement en plusieurs fois : échéancier, prochaine échéance et montant dû", () => {
  const o = { total: 31750, createdAt: new Date("2026-10-29T10:00:00Z"), installmentCount: 3, installmentsPaid: 1, installmentIntervalDays: 15 };
  assert.deepEqual(schedule(o).map((l) => l.paid), [true, false, false]);
  const n = nextInstallment(o)!;
  assert.equal(n.n, 2);
  assert.equal(n.amount, 10500);
  const pay = { ...o, isReservation: false, depositAmount: 0, depositPaidAt: null, reservationStatus: null };
  assert.deepEqual(amountDue(pay), { amount: 10500, part: "ECHEANCE" });
  assert.equal(amountDue({ ...pay, installmentsPaid: 3 }), null);
  assert.deepEqual(amountDue({ ...pay, installmentCount: 0 }), { amount: 31750, part: "TOTAL" });
  assert.equal(nextInstallment({ ...o, installmentsPaid: 3 }), null);
  assert.match(reminderText({ firstName: "Awa", n: 2, of: 3, amount: 10500, dueAt: n.dueAt, today: false, ref: "AB" }), /échéance 2\/3[\s\S]*10 500 F CFA[\s\S]*13 novembre/);
});
