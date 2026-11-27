import { test } from "node:test";
import assert from "node:assert/strict";
import { amountDue, balanceOf, depositFor, normalizeReservation, DEFAULT_RESERVATION } from "../reservation";

test("réservation : réglages par défaut et bornes", () => {
  assert.deepEqual(normalizeReservation(null), DEFAULT_RESERVATION);
  assert.deepEqual(DEFAULT_RESERVATION, { enabled: true, depositPercent: 30, delayLabel: "15 à 21 jours", refundable: true, freeCancelHours: 24, penaltyPercent: 10 });
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

test("réservation annulée : gratuite 24 h, ensuite 10 % de la somme payée retenus ; JAMAAL rend tout", async () => {
  const { cancellationTerms, cancelPolicyText } = await import("../reservation");
  const s = { freeCancelHours: 24, penaltyPercent: 10 };
  const at = new Date("2026-11-27T10:00:00Z");
  assert.deepEqual(cancellationTerms(6000, at, new Date("2026-11-28T09:00:00Z"), s, true), { penalty: 0, refund: 6000, free: true });
  assert.deepEqual(cancellationTerms(6000, at, new Date("2026-11-28T11:00:00Z"), s, true), { penalty: 600, refund: 5400, free: false });
  assert.deepEqual(cancellationTerms(6000, at, new Date("2026-12-20T11:00:00Z"), s, false), { penalty: 0, refund: 6000, free: true });
  assert.deepEqual(cancellationTerms(0, at, new Date("2026-12-20T11:00:00Z"), s, true), { penalty: 0, refund: 0, free: false });
  assert.equal(cancelPolicyText(s), "annulation gratuite pendant 24 h, ensuite 10 % de la somme payée retenus");
  assert.equal(normalizeReservation({ penaltyPercent: 80 }).penaltyPercent, 10);
  assert.equal(normalizeReservation({ freeCancelHours: 48, penaltyPercent: 15 }).freeCancelHours, 48);
});
