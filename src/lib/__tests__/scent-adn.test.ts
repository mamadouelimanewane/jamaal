import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfile, findReference, matchScents, parseAdnAnswers, profileSummary, type ScentProduct } from "../scent/adn";

const P = (o: Partial<ScentProduct> & { id: string }): ScentProduct => ({ slug: o.id, name: o.id, category: "parfum-unisexe", ...o });
const catalog: ScentProduct[] = [
  P({ id: "fresh-man", name: "Blue Ocean", category: "parfum-homme", inspiredBy: "Sauvage", inspiredBrand: "Dior", family: "Aromatique frais", topNotes: ["Bergamote", "Poivre"], baseNotes: ["Ambroxan"] }),
  P({ id: "aqua", name: "Aqua Soul", category: "parfum-homme", family: "Frais marin", topNotes: ["Bergamote", "Notes marines"], baseNotes: ["Musc"] }),
  P({ id: "rose", name: "Rose Gold", category: "parfum-femme", family: "Floral", heartNotes: ["Rose", "Jasmin"], baseNotes: ["Musc"] }),
  P({ id: "vanilla", name: "Sweet Night", category: "parfum-femme", inspiredBy: "La Vie Est Belle", family: "Gourmand", topNotes: ["Fruits rouges"], heartNotes: ["Iris"], baseNotes: ["Vanille", "Praline"] }),
  P({ id: "oud", name: "Royal Oud", category: "parfum-unisexe", family: "Oriental boisé", baseNotes: ["Oud", "Santal", "Ambre"] }),
  P({ id: "soap", name: "Gel douche", category: "soin-corps" }),
];

test("reconnaît un parfum connu malgré la marque et les accents", () => {
  assert.ok(findReference("Dior Sauvage"));
  assert.ok(findReference("j'adore"));
  assert.equal(findReference("xyz inconnu"), null);
});

test("un parfum inspiré du parfum porté arrive en tête à 98 %", () => {
  const { matches } = matchScents(parseAdnAnswers({ worn: "Sauvage", gender: "homme" }), catalog);
  assert.equal(matches[0].product.id, "fresh-man");
  assert.equal(matches[0].percent, 98);
  assert.equal(matches[0].direct, true);
  assert.match(matches[0].reason, /Sauvage/);
  assert.equal(matches[1].product.id, "aqua", "puis un parfum de la même famille fraîche");
  assert.ok(matches[1].percent < 98);
});

test("ne propose ni un soin ni un parfum de l'autre genre en premier", () => {
  const { matches } = matchScents(parseAdnAnswers({ worn: [], gender: "femme", families: ["gourmand"] }), catalog);
  assert.equal(matches[0].product.id, "vanilla");
  assert.ok(matches.every((m) => m.product.category.startsWith("parfum")));
  assert.ok(!matches.slice(0, 2).some((m) => m.product.category === "parfum-homme"));
});

test("profil : familles et notes déduites des parfums portés", () => {
  const p = buildProfile(parseAdnAnswers({ worn: "Black Opium, Baccarat Rouge" }), catalog);
  assert.ok(p.families.includes("gourmand") || p.families.includes("oriental"));
  assert.equal(p.recognised.length, 2);
  assert.match(profileSummary(p), /porte Black Opium, Baccarat Rouge/);
});

test("réponses invalides ignorées", () => {
  const a = parseAdnAnswers({ worn: "a, ,Sauvage", gender: "x", families: ["frais", "nimporte"], intensity: "fort" });
  assert.deepEqual(a.worn, ["Sauvage"]);
  assert.equal(a.gender, null);
  assert.deepEqual(a.families, ["frais"]);
  assert.equal(a.intensity, null);
});
