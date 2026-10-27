import { test } from "node:test";
import assert from "node:assert/strict";
import type { StockRow } from "../inventory-report";

test("Handbook Dakar – structure des lignes de stock à l'instant T", () => {
  const row: StockRow = {
    key: "var-024-100",
    productId: "prod-024",
    variantId: "var-024-100",
    name: "Extrait de Parfum N°024",
    productCode: "024",
    inspiredBy: "Black Opium",
    inspiredBrand: "Yves Saint Laurent",
    slug: "extrait-de-parfum-024",
    category: "parfums-femme",
    categoryLabel: "Parfums Femme",
    code: "024-100",
    format: "100 ml",
    stock: 14,
    threshold: 3,
    salePrice: 14800,
    unitCost: 7400,
    sold30: 22,
    coverageDays: 19,
    toOrder: 0,
    status: "ok",
  };

  assert.equal(row.productCode, "024");
  assert.equal(row.name, "Extrait de Parfum N°024");
  assert.equal(row.inspiredBy, "Black Opium");
  assert.equal(row.format, "100 ml");
  assert.equal(row.stock, 14);
  assert.equal(row.salePrice, 14800);
  assert.equal(row.status, "ok");
  assert.ok(row.stock > 0, "Doit être disponible en stock");
});

test("Handbook Dakar – détection des ruptures de stock", () => {
  const ruptureRow: StockRow = {
    key: "var-094-100",
    productId: "prod-094",
    variantId: "var-094-100",
    name: "Extrait de Parfum N°094",
    productCode: "094",
    inspiredBy: "Sauvage",
    inspiredBrand: "Dior",
    slug: "extrait-de-parfum-094",
    category: "parfums-homme",
    categoryLabel: "Parfums Homme",
    code: "094-100",
    format: "100 ml",
    stock: 0,
    threshold: 5,
    salePrice: 14800,
    unitCost: 7400,
    sold30: 45,
    coverageDays: 0,
    toOrder: 45,
    status: "rupture",
  };

  assert.equal(ruptureRow.stock, 0);
  assert.equal(ruptureRow.status, "rupture");
});
