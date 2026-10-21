import { test } from "node:test";
import assert from "node:assert/strict";
import { findProducts, inspirationLabel } from "../product-finder";

const P = [
  { name: "Aqua Soul for Him", choganCode: "021M", inspiredBy: "Light Blue", inspiredBrand: "Dolce & Gabbana" },
  { name: "Deep Blue for Him", choganCode: "002M", inspiredBy: "Acqua di Giò", inspiredBrand: "Armani" },
  { name: "Gel douche Homme", choganCode: null },
  { name: "Élixir de nuit", choganCode: "090W", inspiredBy: "Sauvage", inspiredBrand: "Dior" },
];

test("recherche produit : par nom, sans accents ni majuscules", () => {
  assert.deepEqual(findProducts(P, "elixir").map((p) => p.name), ["Élixir de nuit"]);
  assert.deepEqual(findProducts(P, "GEL").map((p) => p.name), ["Gel douche Homme"]);
});

test("recherche produit : par code Chogan, le code exact en premier", () => {
  assert.equal(findProducts(P, "002m")[0].name, "Deep Blue for Him");
});

test("recherche produit : par parfum d'inspiration ou par marque", () => {
  assert.equal(findProducts(P, "acqua di gio")[0].name, "Deep Blue for Him");
  assert.equal(findProducts(P, "sauvage")[0].name, "Élixir de nuit");
  assert.equal(findProducts(P, "dior")[0].name, "Élixir de nuit");
});

test("recherche produit : plusieurs mots, le nom qui commence par la recherche d'abord", () => {
  assert.deepEqual(findProducts(P, "for him").map((p) => p.name), ["Aqua Soul for Him", "Deep Blue for Him"]);
  assert.equal(findProducts(P, "blue")[0].name, "Deep Blue for Him");
  assert.deepEqual(findProducts(P, "a"), []);
});

test("libellé d'inspiration", () => {
  assert.equal(inspirationLabel(P[1]), "inspiré de Acqua di Giò (Armani)");
  assert.equal(inspirationLabel(P[2]), "");
});
