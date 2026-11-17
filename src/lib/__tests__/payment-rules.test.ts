import { test } from "node:test";
import assert from "node:assert/strict";
import { alignedStatus, paymentStage, statusChangeError, statusForPayment } from "../orders/payment-rules";

const unpaid = { paymentStatus: "EN_ATTENTE", depositPaidAt: null, installmentsPaid: 0 };
const deposit = { paymentStatus: "EN_ATTENTE", depositPaidAt: new Date(), installmentsPaid: 0 };
const installment = { paymentStatus: "EN_ATTENTE", depositPaidAt: null, installmentsPaid: 1 };
const paid = { paymentStatus: "PAYE", depositPaidAt: null, installmentsPaid: 0 };

test("le statut avant expédition suit le paiement", () => {
  assert.equal(statusForPayment(paymentStage(unpaid)), "NON_PAYEE");
  assert.equal(statusForPayment(paymentStage(deposit)), "EN_ATTENTE");
  assert.equal(statusForPayment(paymentStage(installment)), "EN_ATTENTE");
  assert.equal(statusForPayment(paymentStage(paid)), "CONFIRMEE");
});

test("« Confirmée » refusée sans paiement total, « En attente » refusée sans acompte", () => {
  assert.match(statusChangeError(unpaid, "CONFIRMEE") ?? "", /paiement total/);
  assert.match(statusChangeError(deposit, "CONFIRMEE") ?? "", /paiement total/);
  assert.match(statusChangeError(unpaid, "EN_ATTENTE") ?? "", /acompte/);
  assert.equal(statusChangeError(deposit, "EN_ATTENTE"), null);
  assert.equal(statusChangeError(paid, "CONFIRMEE"), null);
  assert.ok(statusChangeError(paid, "EN_ATTENTE"));
  assert.ok(statusChangeError(deposit, "NON_PAYEE"));
});

test("expédier, livrer ou annuler ne dépend pas de cette règle (paiement à la livraison)", () => {
  for (const s of ["EXPEDIEE", "LIVREE", "ANNULEE"] as const) assert.equal(statusChangeError(unpaid, s), null);
});

test("réalignement après un paiement", () => {
  assert.equal(alignedStatus({ ...paid, status: "NON_PAYEE" }), "CONFIRMEE");
  assert.equal(alignedStatus({ ...deposit, status: "NON_PAYEE" }), "EN_ATTENTE");
  assert.equal(alignedStatus({ ...paid, status: "EXPEDIEE" }), null);
  assert.equal(alignedStatus({ ...unpaid, status: "NON_PAYEE" }), null);
});
