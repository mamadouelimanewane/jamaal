import { test } from "node:test";
import assert from "node:assert/strict";
import { availableFirst, inStockOf } from "../availability";

test("disponible si un format est en stock, sinon selon le stock du produit", () => {
  assert.equal(inStockOf(0, [{ stock: 0 }, { stock: 2 }]), true);
  assert.equal(inStockOf(5, [{ stock: 0 }]), false);
  assert.equal(inStockOf(3, []), true);
  assert.equal(inStockOf(0, null), false);
});

test("disponibles d'abord, ordre conservé dans chaque groupe", () => {
  const l = [{ n: 1, inStock: false }, { n: 2, inStock: true }, { n: 3 }, { n: 4, inStock: false }, { n: 5, inStock: true }];
  assert.deepEqual(availableFirst(l).map((x) => x.n), [2, 3, 5, 1, 4]);
});
