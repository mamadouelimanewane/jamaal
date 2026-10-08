import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, tokenize, editDistance, codeAliases, prepare, search, suggest, brandFacets, categoryFacets, type SearchDoc } from "../search-engine";

function doc(over: Partial<SearchDoc>): SearchDoc {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    slug: "x", name: "Produit", choganCode: null, number: null, inspiredBy: null, inspiredBrand: null,
    category: "parfum-homme", categoryLabel: "Homme", family: null, notes: [], price: 28700, photo: null,
    colorFrom: "", colorTo: "", popularity: 0, ...over,
  };
}

const DOCS = prepare([
  doc({ id: "p1", name: "Prestige for Him Parfum homme", choganCode: "001M", number: 11696, inspiredBy: "One Million", inspiredBrand: "Paco Rabanne", notes: ["Cannelle", "Cuir"] }),
  doc({ id: "p2", name: "Revenant Intense Parfum homme", choganCode: "094M", number: 12706, inspiredBy: "Sauvage", inspiredBrand: "Dior", price: 39400 }),
  doc({ id: "p3", name: "Gel douche Homme", choganCode: "BSF094", number: 6512, inspiredBy: "Sauvage", inspiredBrand: "Dior", category: "gels-douche", categoryLabel: "Gels douche", price: 13000 }),
  doc({ id: "p4", name: "Pure Gold Parfum femme", choganCode: "007W", number: 11766, inspiredBy: "J'adore", inspiredBrand: "Dior", category: "parfum-femme", categoryLabel: "Femme" }),
  doc({ id: "p5", name: "Black Addiction Parfum femme", choganCode: "055W", number: 12301, inspiredBy: "Black Opium", inspiredBrand: "Yves Saint Laurent", category: "parfum-femme", categoryLabel: "Femme" }),
  doc({ id: "p6", name: "Crème de savon à la Grenade", choganCode: "SP07B", number: 7574, category: "soins-corps", categoryLabel: "Soins corps", description: "Savon crémeux à l'extrait de grenade, idéal pour les mains.", volumes: ["300 ml"] }),
  doc({ id: "p7", name: "Essence 060 Parfum homme essence 30%", choganCode: "060", number: 9049, inspiredBy: "Millésime Impérial", inspiredBrand: "Creed" }),
  doc({ id: "p8", name: "Scarlet Fire Parfum unisexe luxury", choganCode: "118U", number: 12011, inspiredBy: "Baccarat Rouge 540", inspiredBrand: "Maison Francis Kurkdjian", category: "parfum-unisexe", categoryLabel: "Unisexe" }),
]);
const ids = (q: string) => search(DOCS, q).hits.map((h) => h.doc.id);

test("normalisation : accents, majuscules, apostrophes", () => {
  assert.equal(normalize("Crème  Brûlée"), "creme brulee");
  assert.equal(normalize("J’adore"), "j adore");
  assert.deepEqual(tokenize("Le parfum de Dior"), ["dior"]);
});

test("distance d'édition (inversion de lettres comptée 1)", () => {
  assert.equal(editDistance("sauvage", "sauvage"), 0);
  assert.equal(editDistance("sauvaje", "sauvage"), 1);
  assert.equal(editDistance("suavage", "sauvage"), 1);
  assert.ok(editDistance("dior", "chanel", 2) > 2);
});

test("codes des autres formats", () => {
  assert.deepEqual(codeAliases("001M"), ["001m", "301m", "t001m", "t001"]);
  assert.ok(codeAliases("150M").includes("3150m"));
  assert.ok(codeAliases("060").includes("360"));
  assert.deepEqual(codeAliases("BSF016"), ["bsf016"]);
  assert.deepEqual(codeAliases(null), []);
});

test("recherche par code, format, numéro de fiche", () => {
  assert.equal(ids("001M")[0], "p1");
  assert.equal(ids("001m")[0], "p1");
  assert.equal(ids("301M")[0], "p1", "code 30 ml");
  assert.equal(ids("T001M")[0], "p1", "code 15 ml");
  assert.equal(ids("001")[0], "p1");
  assert.equal(ids("11696")[0], "p1");
  assert.equal(ids("bsf094")[0], "p3");
  assert.equal(ids("360")[0], "p7");
});

test("recherche par parfum d'inspiration et marque", () => {
  assert.deepEqual(ids("sauvage"), ["p2", "p3"], "parfum avant le gel douche");
  assert.ok(ids("dior").length === 3);
  assert.equal(ids("one million")[0], "p1");
  assert.equal(ids("baccarat rouge")[0], "p8");
  assert.equal(ids("kurkdjian")[0], "p8");
});

test("tolérance : fautes, accents, mots collés, synonymes", () => {
  assert.equal(ids("sauvaje")[0], "p2");
  assert.equal(ids("jadore")[0], "p4");
  assert.equal(ids("j'adore")[0], "p4");
  assert.equal(ids("blackopium")[0], "p5");
  assert.equal(ids("ysl")[0], "p5");
  assert.equal(ids("creme grenade")[0], "p6");
  assert.equal(ids("CRÈME")[0], "p6");
});

test("tous les mots doivent correspondre", () => {
  assert.deepEqual(ids("gel douche sauvage"), ["p3"]);
  assert.deepEqual(ids("sauvage chanel"), []);
});

test("description, notes et formats sont indexés", () => {
  assert.equal(ids("mains")[0], "p6", "mot de la description");
  assert.equal(ids("cannelle")[0], "p1", "note olfactive");
  assert.equal(ids("300 ml")[0], "p6", "format");
});

test("requête vide ou sans mot utile", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("   "), []);
  assert.deepEqual(ids("de la"), []);
});

test("vouliez-vous dire", () => {
  assert.equal(suggest(DOCS, "baccara ruge"), "baccarat rouge");
  assert.equal(suggest(DOCS, "sauvage"), null);
});

test("facettes marques et collections", () => {
  const hits = search(DOCS, "dior").hits;
  assert.deepEqual(brandFacets(hits), [{ brand: "Dior", count: 3 }]);
  const cats = categoryFacets(hits);
  assert.equal(cats.find((c) => c.slug === "parfum-homme")?.count, 1);
  assert.equal(cats.reduce((s, c) => s + c.count, 0), 3);
});
