import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestOrder, stockStatus } from "../inventory-report";

test("état du stock : rupture, bas, en stock", () => {
  assert.equal(stockStatus(0, 3), "rupture");
  assert.equal(stockStatus(-1, 3), "rupture");
  assert.equal(stockStatus(3, 3), "bas");
  assert.equal(stockStatus(4, 3), "ok");
});

test("quantité à commander", () => {
  assert.equal(suggestOrder(10, 3, 0), 0, "stock confortable, pas de ventes");
  assert.equal(suggestOrder(2, 3, 0), 4, "sous le seuil : remonter à 2 × seuil");
  assert.equal(suggestOrder(0, 5, 0), 10);
  assert.equal(suggestOrder(10, 3, 60), 50, "60 ventes/30 j, 5 jours de couverture : remonter à 60");
  assert.equal(suggestOrder(40, 3, 60), 0, "20 jours de couverture : rien à commander");
  assert.equal(suggestOrder(20, 3, 60), 40, "10 jours de couverture : remonter à 30 jours de ventes");
});
