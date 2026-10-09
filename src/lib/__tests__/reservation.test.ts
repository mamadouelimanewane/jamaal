import { test } from "node:test";
import assert from "node:assert/strict";
import { amountDue, balanceOf, depositFor, normalizeReservation, DEFAULT_RESERVATION } from "../reservation";

test("réservation : réglages par défaut et bornes", () => {
  assert.deepEqual(normalizeReservation(null), DEFAULT_RESERVATION);
  assert.deepEqual(DEFAULT_RESERVATION, { enabled: true, depositPercent: 30, delayLabel: "15 à 21 jours", refundable: true });
  assert.equal(normalizeReservation({ depositPercent: 5 }).depositPercent, 30);
  assert.equal(normalizeReservation({ depositPercent: 150 }).depositPercent, 30);
  assert.equal(normalizeReservation({ depositPercent: 50, delayLabel: "  3 semaines ", enabled: false, refundable: false }).delayLabel, "3 semaines");
});

test("réservation : acompte arrondi à la centaine supérieure", () => {
  assert.equal(depositFor(30000, 30), 9000);
  assert.equal(depositFor(28700, 30), 8700);
  assert.equal(depositFor(28750, 30), 8700); // 8 625 → 8 700
  assert.equal(depositFor(1000, 100), 1000);
  assert.equal(depositFor(150, 90), 150); // jamais plus que le prix
  assert.equal(depositFor(0, 30), 0);
});

test("réservation : montant à payer selon l'étape", () => {
  const base = { total: 31300, isReservation: true, depositAmount: 9000, depositPaidAt: null as Date | null, reservationStatus: "ACOMPTE_ATTENDU" };
  assert.deepEqual(amountDue(base), { amount: 9000, part: "ACOMPTE" });
  assert.equal(amountDue({ ...base, depositPaidAt: new Date(), reservationStatus: "RESERVEE" }), null);
  assert.deepEqual(amountDue({ ...base, depositPaidAt: new Date(), reservationStatus: "DISPONIBLE" }), { amount: 22300, part: "SOLDE" });
  assert.equal(amountDue({ ...base, reservationStatus: "ANNULEE" }), null);
  assert.equal(amountDue({ ...base, depositPaidAt: new Date(), reservationStatus: "SOLDEE" }), null);
  assert.deepEqual(amountDue({ ...base, isReservation: false }), { amount: 31300, part: "TOTAL" });
  assert.equal(balanceOf({ ...base, depositPaidAt: new Date() }), 22300);
  assert.equal(balanceOf(base), 31300);
});
