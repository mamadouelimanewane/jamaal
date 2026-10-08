/**
 * Complétude sur le vrai catalogue (≈ 580 produits) : chaque produit doit être trouvable par
 * son code Chogan, son numéro de fiche, son nom et son parfum d'inspiration.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prepare, search, type SearchDoc } from "../search-engine";

const root = join(__dirname, "..", "..", "..");
const catalog: { id: string; slug: string; name: string; number: number; category: string; shortDescription: string; regularPrice: number }[] = JSON.parse(readFileSync(join(root, "src/data/chogan-catalog.json"), "utf8"));
const codeSql = readFileSync(join(root, "db/sql/20261008-07-code-chogan.sql"), "utf8");
const inspSql = readFileSync(join(root, "db/sql/20261008-08-inspirations-parfums.sql"), "utf8");
const codes = new Map([...codeSql.matchAll(/\('(chogan-\d+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]]));
const unq = (s: string) => s.replace(/''/g, "'");
const insp = new Map([...inspSql.matchAll(/\('(chogan-\d+)', '((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)].map((m) => [m[1], [unq(m[2]), unq(m[3])] as const]));

const docs: SearchDoc[] = catalog.map((p) => ({
  id: p.id, slug: p.slug, name: p.name, choganCode: codes.get(p.id) ?? null, number: p.number,
  inspiredBy: insp.get(p.id)?.[0] ?? null, inspiredBrand: insp.get(p.id)?.[1] ?? null,
  category: p.category, categoryLabel: p.category, family: null, notes: [], description: p.shortDescription,
  price: p.regularPrice, photo: null, colorFrom: "", colorTo: "", popularity: 0,
}));
const index = prepare(docs);

function rankOf(q: string, id: string) {
  const { hits } = search(index, q, 10_000);
  const i = hits.findIndex((h) => h.doc.id === id);
  return { i, hits };
}

test("le catalogue est entièrement indexé", () => {
  assert.ok(docs.length >= 570, `${docs.length} produits`);
  assert.equal(index.length, docs.length);
});

test("chaque produit est trouvé en premier par son numéro de fiche", () => {
  const misses = docs.filter((d) => rankOf(String(d.number), d.id).i !== 0).map((d) => d.number);
  assert.deepEqual(misses, []);
});

test("chaque produit est trouvé par son code Chogan (en tête, ou ex aequo avec le même code)", () => {
  const misses: string[] = [];
  for (const d of docs.filter((x) => x.choganCode)) {
    const { i, hits } = rankOf(d.choganCode!, d.id);
    if (i < 0 || hits[i].score < hits[0].score) misses.push(`${d.choganCode} (${d.id})`);
  }
  assert.deepEqual(misses, []);
});

test("chaque produit est trouvé par son nom exact, avec le meilleur score", () => {
  const misses: string[] = [];
  for (const d of docs) {
    const { i, hits } = rankOf(d.name, d.id);
    if (i < 0 || hits[i].score < hits[0].score) misses.push(d.name);
  }
  assert.deepEqual(misses, []);
});

test("chaque parfum inspiré est trouvé par « parfum + marque »", () => {
  const misses: string[] = [];
  for (const d of docs.filter((x) => x.inspiredBy)) {
    if (rankOf(`${d.inspiredBy} ${d.inspiredBrand}`, d.id).i < 0) misses.push(`${d.inspiredBy} ${d.inspiredBrand}`);
  }
  assert.deepEqual(misses, []);
});

test("les parfums 70 ml sont trouvés par leurs codes 30 ml et 15 ml", () => {
  const perfumes = docs.filter((d) => /^\d{3}[MWUB]$/.test(d.choganCode ?? ""));
  assert.ok(perfumes.length > 100);
  const misses: string[] = [];
  for (const d of perfumes) {
    const n = d.choganCode!;
    const thirty = `3${n.startsWith("0") ? n.slice(1) : n}`;
    for (const q of [thirty, `T${n}`]) if (rankOf(q, d.id).i !== 0) misses.push(`${q}→${n}`);
  }
  assert.deepEqual(misses, []);
});

test("une faute de frappe sur le parfum d'inspiration retrouve le produit", () => {
  const typo = (w: string) => (w.length >= 6 ? w.slice(0, 2) + w[3] + w[2] + w.slice(4) : w); // inversion de lettres
  const misses: string[] = [];
  for (const d of docs.filter((x) => x.inspiredBy && x.inspiredBy.length >= 6 && !x.inspiredBy.includes(" "))) {
    if (rankOf(typo(d.inspiredBy!), d.id).i < 0) misses.push(`${typo(d.inspiredBy!)} (${d.inspiredBy})`);
  }
  assert.deepEqual(misses, []);
});

test("rapidité : moins de 15 ms par recherche en moyenne", () => {
  const qs = ["sauvage", "dior", "001m", "baccarat rouge", "gel douche", "creme", "vanille", "oud wood tom ford", "12706", "jadore"];
  const t0 = performance.now();
  for (let k = 0; k < 10; k++) for (const q of qs) search(index, q);
  const avg = (performance.now() - t0) / (qs.length * 10);
  assert.ok(avg < 15, `${avg.toFixed(2)} ms`);
});
