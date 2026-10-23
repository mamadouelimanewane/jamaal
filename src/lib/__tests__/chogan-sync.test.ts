import { test } from "node:test";
import assert from "node:assert/strict";
import { priceUpdate } from "../chogan/price-sync";

const preview = { publicPrice: 30_000, regularPrice: 28_000, volumes: [{ label: "30 ml", code: "021M30", publicPrice: 16_000, price: 15_000 }, { label: "70 ml", code: "021M", publicPrice: 30_000, price: 28_000 }] };

test("prix inchangés : rien à faire", () => {
  assert.equal(priceUpdate({ publicPrice: 30_000, regularPrice: 28_000, volumes: [{ label: "30 ml", price: 15_000 }, { label: "70ml", price: 28_000 }] }, preview), null);
});

test("nouveaux prix Chogan : formats mis à jour, libellés et codes conservés", () => {
  const u = priceUpdate({ publicPrice: 28_700, regularPrice: 26_000, volumes: [{ label: "30 ml", price: 14_800, code: "A" }, { label: "70 ml", price: 26_000, code: "B" }] }, preview)!;
  assert.deepEqual(u.volumes, [{ label: "30 ml", price: 15_000, code: "A" }, { label: "70 ml", price: 28_000, code: "B" }]);
  assert.equal(u.regularPrice, 28_000);
  assert.equal(u.publicPrice, 30_000);
  assert.equal(u.changes.length, 2);
});

test("format unique et produit sans format", () => {
  const one = priceUpdate({ publicPrice: 10_000, regularPrice: 9_000, volumes: [{ label: "Unique", price: 9_000 }] }, { publicPrice: 12_000, regularPrice: 11_000, volumes: null })!;
  assert.deepEqual(one.volumes, [{ label: "Unique", price: 11_000 }]);
  const none = priceUpdate({ publicPrice: 10_000, regularPrice: 9_000, volumes: null }, { publicPrice: 12_000, regularPrice: 11_000, volumes: null })!;
  assert.equal(none.regularPrice, 11_000);
  assert.equal(none.volumes, undefined);
  assert.equal(priceUpdate({ publicPrice: 10_000, regularPrice: 9_000, volumes: null }, { publicPrice: 10_020, regularPrice: 9_010, volumes: null }), null, "arrondi");
});
