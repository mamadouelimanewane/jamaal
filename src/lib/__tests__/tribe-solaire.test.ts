import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CAUTIONS, longOf, shortOf } from "../../../scripts/import-tribe-solaire.mjs";

const items = JSON.parse(fs.readFileSync(path.join(process.cwd(), "import/aurodhea-solaire-catalogue.json"), "utf8"));

const EXPECTED_CODES = [
  "SOL01B",
  "SOL02B",
  "SOL03B",
  "SOL04B",
  "SOL25",
  "SOL24",
  "SOL26",
  "SOL27",
  "SOL05B",
  "SOL21",
  "SOL22",
  "U20B",
  "SV01",
  "CR06B",
  "BS05B",
  "MD24",
  "CR23B",
];

test("les 17 produits du catalogue Ligne Solaire Tribe sont présents", () => {
  assert.deepEqual(
    items.map((p: { code: string }) => p.code),
    EXPECTED_CODES
  );
});

test("chaque fiche a une description et des précautions, et cite la gamme dans le résumé", () => {
  for (const p of items) {
    const long = longOf(p);
    assert.ok(long.length >= 2, p.code);
    assert.match(long[long.length - 1], /^Précautions : usage externe/);
    assert.ok(Object.values(CAUTIONS).includes(long[long.length - 1]), p.code);
    assert.match(shortOf(p), /Chogan\.$/);
  }
});

test("le SQL ne remplace que les textes générés automatiquement", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "db/sql/20261011-14-fiches-tribe-solaire.sql"), "utf8");
  const updates = sql.split("\n").filter((l) => l.startsWith("UPDATE"));
  assert.equal(updates.length, 34);
  for (const u of updates) {
    assert.match(
      u,
      /\("shortDescription" LIKE '%Produit Chogan, distribué au Sénégal par JAMAAL\.' OR "shortDescription" LIKE '%Produit Chogan\.'\)|coalesce\(cardinality\("longDescription"\), 0\) = 0 OR \(cardinality\("longDescription"\) <= 2 AND \(array_to_string\("longDescription", ' '\) LIKE '%distribué au Sénégal par JAMAAL%' OR array_to_string\("longDescription", ' '\) LIKE '%Produit officiel Chogan%'\)\)/
    );
  }
});
