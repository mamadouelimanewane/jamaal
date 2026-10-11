import { test } from "node:test";
import assert from "node:assert/strict";
import { filterStockRows, productStockSummary } from "../admin-search";
import type { StockRow } from "../inventory-report";

function row(over: Partial<StockRow>): StockRow {
  return {
    key: over.key ?? Math.random().toString(36).slice(2), productId: "p1", variantId: null, name: "Prestige", slug: "x",
    category: "parfum-homme", categoryLabel: "Homme", code: null, format: "70 ml", stock: 8, threshold: 5,
    salePrice: 28700, unitCost: null, sold30: 0, coverageDays: null, toOrder: 0, status: "ok", ...over,
  };
}

const ROWS = [
  row({ key: "a70", productId: "a", code: "001M", format: "70 ml" }),
  row({ key: "a30", productId: "a", code: "301M", format: "30 ml", stock: 0, status: "rupture" }),
  row({ key: "a15", productId: "a", code: "T001M", format: "Recharge 15 ml" }),
  row({ key: "b70", productId: "b", code: "094M", format: "70 ml", stock: 3, status: "bas" }),
  row({ key: "c", productId: "c", code: "BSF094", format: "Format unique" }),
];

test("un code de format exact ne garde que ce format", () => {
  const r = filterStockRows(ROWS, "301m", { ids: ["a"], corrected: null });
  assert.deepEqual(r.map((x) => x.key), ["a30"]);
});

test("ordre de pertinence des produits, puis formats", () => {
  const r = filterStockRows(ROWS, "sauvage", { ids: ["c", "b", "a"], corrected: null });
  assert.deepEqual(r.map((x) => x.key), ["c", "b70", "a30", "a70", "a15"]);
});

test("un volume demandé ne garde que ce format s'il existe", () => {
  assert.deepEqual(filterStockRows(ROWS, "prestige 30 ml", { ids: ["a"], corrected: null }).map((x) => x.key), ["a30"]);
  assert.deepEqual(filterStockRows(ROWS, "prestige 15ml", { ids: ["a"], corrected: null }).map((x) => x.key), ["a15"]);
  // Volume absent : on garde tous les formats plutôt que rien.
  assert.equal(filterStockRows(ROWS, "prestige 100 ml", { ids: ["a"], corrected: null }).length, 3);
});

test("résumé du stock d'un produit à partir de ses formats", () => {
  const s = productStockSummary(ROWS);
  assert.deepEqual(s.get("a"), { total: 16, formats: 3, rupture: 1, bas: 0, status: "bas" });
  assert.equal(s.get("b")?.status, "bas");
  assert.equal(s.get("c")?.status, "ok");
  assert.equal(productStockSummary([row({ productId: "z", stock: 0, status: "rupture" })]).get("z")?.status, "rupture");
});
