import { test } from "node:test";
import assert from "node:assert/strict";
import { replacementRefusal, settlementFor } from "../orders/replace-item";

const base = { status: "CONFIRMEE", paymentStatus: "PAYE", paymentMethod: "WAVE", deliveryStatus: "A_PREPARER", installmentCount: 0, isReservation: false, reservationStatus: null };

test("remplacement : possible tant que le colis n'est pas parti", () => {
  assert.equal(replacementRefusal(base, "CLIENT"), null);
  assert.equal(replacementRefusal({ ...base, status: "NON_PAYEE", paymentStatus: "EN_ATTENTE" }, "CLIENT"), null);
  assert.match(replacementRefusal({ ...base, status: "EXPEDIEE" }, "CLIENT")!, /déjà parti/);
  assert.match(replacementRefusal({ ...base, deliveryStatus: "EN_ROUTE" }, "ADMIN")!, /déjà parti/);
  assert.match(replacementRefusal({ ...base, status: "LIVREE" }, "ADMIN")!, /livrée/);
  assert.match(replacementRefusal({ ...base, status: "ANNULEE" }, "ADMIN")!, /annulée/);
  assert.match(replacementRefusal({ ...base, installmentCount: 3 }, "CLIENT")!, /plusieurs fois/);
  assert.match(replacementRefusal({ ...base, isReservation: true, reservationStatus: "SOLDEE" }, "CLIENT")!, /réservation/);
  assert.equal(replacementRefusal({ ...base, isReservation: true, reservationStatus: "RESERVEE" }, "CLIENT"), null);
  // Commande réglée par le wallet du revendeur : c'est lui qui la modifie.
  assert.match(replacementRefusal({ ...base, paymentMethod: "WALLET" }, "CLIENT")!, /conseiller/);
  assert.equal(replacementRefusal({ ...base, paymentMethod: "WALLET" }, "REVENDEUR"), null);
});

test("remplacement : règlement de l'écart de prix", () => {
  const paid = { paymentStatus: "PAYE", paymentMethod: "WAVE", isReservation: false, paidBeforeChange: 0, depositPaid: false };
  assert.equal(settlementFor(paid, 0), "AUCUN");
  assert.equal(settlementFor(paid, 4000), "COMPLEMENT");
  assert.equal(settlementFor(paid, -4000), "AVOIR");
  assert.equal(settlementFor({ ...paid, paymentStatus: "EN_ATTENTE" }, 4000), "AUCUN");
  assert.equal(settlementFor({ ...paid, paymentStatus: "EN_ATTENTE", paidBeforeChange: 14800 }, -2000), "AVOIR");
  assert.equal(settlementFor({ ...paid, paymentMethod: "WALLET" }, 4000), "WALLET");
  assert.equal(settlementFor({ ...paid, paymentStatus: "EN_ATTENTE", isReservation: true, depositPaid: true }, -4000), "AUCUN");
});

test("somme à payer : le complément seulement après un remplacement plus cher", async () => {
  const { amountDue } = await import("../reservation");
  const o = { total: 20000, isReservation: false, depositAmount: 0, depositPaidAt: null, reservationStatus: null };
  assert.deepEqual(amountDue(o), { amount: 20000, part: "TOTAL" });
  assert.deepEqual(amountDue({ ...o, paidBeforeChange: 14800 }), { amount: 5200, part: "TOTAL" });
});
