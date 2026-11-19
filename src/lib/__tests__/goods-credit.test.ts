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
