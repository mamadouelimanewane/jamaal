import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateMembers, orderSignals, returnRate, score, singleCustomer, HOLD_SCORE, type OrderCtx } from "../fraud/rules";

const seller = { id: "s", name: "Fatou", whatsapp: "77 111 11 11", email: "fatou@x.sn", deliveryLat: 14.7, deliveryLng: -17.45 };
const ctx = (o: Partial<OrderCtx["order"]>): OrderCtx => ({ order: { customerName: "Client", customerPhone: "770000000", customerEmail: null, deliveryLat: null, deliveryLng: null, ...o }, seller, upline: [{ id: "p", name: "Awa (parrain)", whatsapp: "+221 77 222 22 22", email: null }] });

test("vente normale : aucun signal", () => {
  assert.deepEqual(orderSignals(ctx({})), []);
});

test("auto-achat (même numéro) et achat du parrain : commissions bloquées", () => {
  const a = orderSignals(ctx({ customerPhone: "+221771111111" }));
  assert.equal(a[0].kind, "AUTO_ACHAT");
  assert.ok(score(a) >= HOLD_SCORE);
  const p = orderSignals(ctx({ customerPhone: "772222222" }));
  assert.equal(p[0].kind, "ACHAT_PARRAIN");
  assert.match(p[0].detail, /Awa/);
  assert.equal(orderSignals(ctx({ customerEmail: "FATOU@x.sn" }))[0].kind, "AUTO_ACHAT");
});

test("livraison chez le vendeur seule : signal faible, pas de blocage", () => {
  const s = orderSignals(ctx({ deliveryLat: 14.7002, deliveryLng: -17.4501 }));
  assert.equal(s[0].kind, "LIVRAISON_VENDEUR");
  assert.ok(score(s) < HOLD_SCORE);
});

test("faux filleuls, client unique, retours abusifs", () => {
  const d = (n: number) => new Date(2026, 0, n);
  const dup = duplicateMembers([
    { id: "a", name: "A", whatsapp: "771234567", email: null, idNumber: "1 234 567", sponsorId: null, createdAt: d(1) },
    { id: "b", name: "B", whatsapp: "+221 77 123 45 67", email: null, idNumber: null, sponsorId: "a", createdAt: d(5) },
    { id: "c", name: "C", whatsapp: "779999999", email: null, idNumber: "1234567", sponsorId: "a", createdAt: d(9) },
  ]);
  assert.deepEqual(dup.map((x) => [x.member.id, x.other.id, x.field]), [["b", "a", "numéro WhatsApp"], ["c", "a", "n° de pièce d'identité"]]);
  assert.equal(singleCustomer([{ customerPhone: "770000001" }, { customerPhone: "+221770000001" }, { customerPhone: "770000001" }]), "770000001");
  assert.equal(singleCustomer([{ customerPhone: "770000001" }, { customerPhone: "770000002" }, { customerPhone: "770000001" }]), null);
  const o = (bad: boolean) => ({ cancelledAfterPay: false, refunded: bad, returned: false });
  assert.equal(returnRate([o(true), o(true), o(false), o(false), o(false)]), 0.4);
  assert.equal(returnRate([o(true)]), null);
});
