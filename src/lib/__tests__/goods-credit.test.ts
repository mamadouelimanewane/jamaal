import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateSale, parseItems, saleAmount } from "../goods-credit";

const order = { total: 52_000, deliveryFee: 2_000, items: [{ productId: "a", price: 30_000, quantity: 1 }, { productId: "b", price: 10_000, quantity: 2 }] };

test("montant défalqué = vente hors livraison", () => {
  assert.equal(saleAmount(order), 50_000);
});

test("le crédit le plus ancien est remboursé en premier, sans dépasser la vente", () => {
  const r = allocateSale(order, [{ id: "c1", balance: 20_000, items: [] }, { id: "c2", balance: 100_000, items: [] }]);
  assert.deepEqual(r, [{ creditId: "c1", amount: 20_000 }, { creditId: "c2", amount: 30_000 }]);
});

test("un crédit qui liste des produits n'est remboursé que par ces produits", () => {
  const r = allocateSale(order, [{ id: "c1", balance: 100_000, items: [{ productId: "b", name: "B", qty: 5, unitPrice: 10_000 }] }]);
  assert.deepEqual(r, [{ creditId: "c1", amount: 20_000 }]);
});

test("un crédit soldé ou une vente nulle ne bougent rien", () => {
  assert.deepEqual(allocateSale(order, [{ id: "c1", balance: 0, items: [] }]), []);
  assert.deepEqual(allocateSale({ total: 2_000, deliveryFee: 2_000, items: [] }, [{ id: "c1", balance: 5_000, items: [] }]), []);
});

test("lignes de produits nettoyées", () => {
  assert.deepEqual(parseItems([{ name: " ", qty: 1 }, { name: "Glory", qty: "3", unitPrice: "12000", productId: "x" }, null]), [{ productId: "x", name: "Glory", qty: 3, unitPrice: 12000 }]);
});

test("un format confié (30 ml) n'est remboursé que par les ventes de ce format", () => {
  const o = { total: 60_000, deliveryFee: 0, items: [{ productId: "a", price: 14_800, quantity: 1, volumeLabel: "30 ml" }, { productId: "a", price: 9_800, quantity: 1, volumeLabel: "15 ml · recharge" }] };
  const r = allocateSale(o, [{ id: "c1", balance: 100_000, items: [{ productId: "a", name: "A", qty: 3, unitPrice: 14_800, format: "30 ml" }] }]);
  assert.deepEqual(r, [{ creditId: "c1", amount: 14_800 }]);
});

test("crédit marchandises : ventes qui font baisser la dette", async () => {
  const { countsForCredit } = await import("../goods-credit");
  const base = { paymentStatus: "PAYE", status: "CONFIRMEE" };
  assert.equal(countsForCredit({ ...base, paymentMethod: "WAVE", paymentRef: null }), true);
  assert.equal(countsForCredit({ ...base, paymentMethod: "WALLET", paymentRef: "encaisse:ESPECES" }), true);
  assert.equal(countsForCredit({ ...base, paymentMethod: "WALLET", paymentRef: "wallet" }), false);
  assert.equal(countsForCredit({ ...base, paymentStatus: "EN_ATTENTE", paymentMethod: "WAVE", paymentRef: null }), false);
  assert.equal(countsForCredit({ ...base, status: "ANNULEE", paymentMethod: "WAVE", paymentRef: null }), false);
});

test("crédit marchandises : « 70ml » et « 70 ml » sont le même format", () => {
  const plan = allocateSale(
    { total: 20000, deliveryFee: 0, items: [{ productId: "p1", price: 20000, quantity: 1, volumeLabel: "70ml" }] },
    [{ id: "c1", balance: 50000, items: parseItems([{ productId: "p1", name: "X", qty: 3, unitPrice: 20000, format: "70 ML" }]) }],
  );
  assert.deepEqual(plan, [{ creditId: "c1", amount: 20000 }]);
});
