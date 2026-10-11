import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { longOf, shortOf } from "../../../scripts/import-lolum.mjs";

const items = JSON.parse(fs.readFileSync(path.join(process.cwd(), "import/lolum-catalogue.json"), "utf8"));

test("les 12 produits du catalogue LOLUM sont présents, codes LO001 à LO012", () => {
  assert.deepEqual(items.map((p: { code: string }) => p.code), Array.from({ length: 12 }, (_, i) => `LO0${String(i + 1).padStart(2, "0")}`));
});

test("chaque fiche a composition, bienfaits, mode d'emploi et précautions", () => {
  for (const p of items) {
    const long = longOf(p);
    assert.ok(long.length >= 4, p.code);
    assert.match(long[long.length - 1], /^Précautions : usage externe/);
    assert.match(shortOf(p), /Gamme LOLÛM by Chogan\.$/);
  }
});

test("le SQL ne remplace que les textes générés automatiquement", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "db/sql/20261011-12-fiches-lolum.sql"), "utf8");
  const updates = sql.split("\n").filter((l) => l.startsWith("UPDATE"));
  assert.equal(updates.length, 24);
  for (const u of updates) assert.match(u, /LIKE '%Produit Chogan, distribué au Sénégal par JAMAAL\.'|coalesce\(cardinality\("longDescription"\), 0\) = 0/);
});
