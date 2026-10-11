import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanNote, familyOf, parseLine } from "../../../scripts/import-chogan-notes.mjs";

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/chogan-notes.json"), "utf8")) as {
  id: number;
  code: string;
  family: string | null;
  top: string[];
  heart: string[];
  base: string[];
}[];

test("les notes sont nettoyées et traduites", () => {
  assert.equal(cleanNote("Calamba"), "Oud");
  assert.equal(cleanNote("fève tonka"), "Fève tonka");
  assert.equal(cleanNote("Smoke"), "Fumée");
  assert.equal(cleanNote("R�sine oliban"), "Résine oliban");
  assert.equal(cleanNote("  "), "");
});

test("une ligne Chogan donne les trois étages et une famille", () => {
  const r = parseLine("12706|094M|Notes de tête: Bergamote, Poivre§Notes de cœur: Géranium, Lavande, Patchouli§Notes de fond: Ambroxan, Cèdre, Ciste");
  assert.equal(r.id, 12706);
  assert.deepEqual(r.top, ["Bergamote", "Poivre"]);
  assert.deepEqual(r.base, ["Ambroxan", "Cèdre", "Ciste"]);
  assert.ok(r.family);
});

test("les noms trompeurs ne faussent pas la famille", () => {
  // « Poivre rose » est une épice, « Fleur d'oranger » une fleur, « Noix de muscade » une épice.
  assert.equal(familyOf(["Poivre rose"], ["Noix de muscade"], []), "Épicé");
  assert.equal(familyOf([], ["Fleur d'oranger"], []), "Floral");
  assert.equal(familyOf(["Eau de mer", "Bergamote"], [], ["Musc"]), "Frais aquatique");
  assert.equal(familyOf(["Vanille"], ["Caramel"], ["Fève tonka"]), "Gourmand");
  assert.equal(familyOf([], [], ["Musc"]), null);
});

test("chaque produit relevé a des notes, une famille et un code unique", () => {
  assert.ok(data.length >= 180);
  assert.equal(new Set(data.map((d) => d.id)).size, data.length);
  for (const d of data) {
    assert.ok(d.top.length + d.heart.length + d.base.length > 0, d.code);
    assert.ok(d.family, d.code);
    for (const n of [...d.top, ...d.heart, ...d.base]) assert.ok(!n.includes("\uFFFD") && n === n.trim() && n.length > 1, `${d.code} : « ${n} »`);
  }
});

test("le SQL ne remplace jamais une saisie existante", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "db/sql/20261011-11-notes-olfactives.sql"), "utf8");
  const perProduct = sql.split("\n").filter((l) => l.startsWith(`UPDATE "Product" SET`));
  assert.equal(perProduct.length, data.length);
  for (const u of perProduct) {
    assert.match(u, /coalesce\(cardinality\("topNotes"\), 0\) = 0 AND coalesce\(cardinality\("heartNotes"\), 0\) = 0/);
    assert.match(u, /"family" = COALESCE\(NULLIF\("family", ''\)/);
  }
  // Gels douche et crèmes : même garde, et même parfum d'inspiration exigé.
  assert.match(sql, /coalesce\(cardinality\(g\."topNotes"\), 0\) = 0/);
  assert.match(sql, /lower\(trim\(p\."inspiredBy"\)\) = lower\(trim\(g\."inspiredBy"\)\)/);
});
