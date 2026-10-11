#!/usr/bin/env node
/**
 * Fiches LOLUM : composition, bienfaits et mode d'emploi, d'après le catalogue LOLUM (PDF Chogan,
 * mars 2026), traduits en français dans import/lolum-catalogue.json.
 *
 * Sortie : db/sql/20261011-13-fiches-lolum-textes.sql (appliqué au déploiement, rejouable ; le
 * fichier 12, déjà appliqué, ne remplissait que les descriptions longues vides).
 * Ne remplace que les textes générés automatiquement (« … Produit Chogan, distribué au Sénégal
 * par JAMAAL. », description longue vide ou générique « Produit officiel de la gamme Chogan,
 * distribué au Sénégal… ») : une fiche réécrite au back-office est conservée.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const items = JSON.parse(fs.readFileSync(path.join(ROOT, "import/lolum-catalogue.json"), "utf8"));

export const ESSENTIAL_OIL_CAUTION =
  "Précautions : usage externe ; tenir hors de portée des enfants ; éviter le contact avec les yeux ; déconseillé aux femmes enceintes ou allaitantes et aux jeunes enfants sans avis médical ; faire un essai sur une petite zone de peau avant la première utilisation.";
export const VEGETABLE_OIL_CAUTION =
  "Précautions : usage externe ; éviter le contact avec les yeux ; faire un essai sur une petite zone de peau avant la première utilisation. Ne remplace pas un avis médical.";

export function shortOf(p) {
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const main = p.composition
    .filter(([i]) => !/^Actif exclusif/i.test(i))
    .map(([i]) => lower(i.replace(/^Huile essentielle d[e'’]\s?/i, "").replace(/^Huile d[e'’]\s?/i, "")));
  // REVIZENT : « 25 huiles essentielles » tient lieu de composition.
  const what = /^\d+ huiles essentielles$/.test(main[0] ?? "") && main.length === 1 ? `mélange de ${main[0]}` : `${lower(p.type)} (${main.join(", ")})`;
  return `${p.nom} ${lower(p.action)} — ${what}, ${p.format}. Gamme LOLÛM by Chogan.`;
}

export function longOf(p) {
  return [
    p.bienfaits,
    `Composition : ${p.composition.map(([i, e]) => `${i} (${e})`).join(" ; ")}.`,
    ...p.usages.map(([t, u]) => `${t} : ${u}.`),
    p.huileEssentielle ? ESSENTIAL_OIL_CAUTION : VEGETABLE_OIL_CAUTION,
  ];
}

const s = (v) => `'${String(v).replace(/'/g, "''")}'`;
const arr = (a) => `ARRAY[${a.map(s).join(", ")}]::text[]`;

function main() {
  const lines = [
    "-- Fiches LOLUM : composition, bienfaits et mode d'emploi (catalogue LOLUM Chogan, mars 2026).",
    "-- Généré par scripts/import-lolum.mjs. Ne remplace que les textes générés automatiquement :",
    "-- une fiche réécrite au back-office est conservée. Rejouable sans effet.",
    "",
  ];
  for (const p of items) {
    lines.push(
      `UPDATE "Product" SET "shortDescription" = ${s(shortOf(p))}, "updatedAt" = NOW() ` +
        `WHERE "choganCode" = ${s(p.code)} AND "shortDescription" LIKE '%Produit Chogan, distribué au Sénégal par JAMAAL.';`,
      `UPDATE "Product" SET "longDescription" = ${arr(longOf(p))}, "updatedAt" = NOW() ` +
        `WHERE "choganCode" = ${s(p.code)} AND (coalesce(cardinality("longDescription"), 0) = 0 OR ` +
        `(cardinality("longDescription") <= 2 AND array_to_string("longDescription", ' ') LIKE '%distribué au Sénégal par JAMAAL%'));`
    );
  }
  lines.push("");
  fs.writeFileSync(path.join(ROOT, "db/sql/20261011-13-fiches-lolum-textes.sql"), lines.join("\n"));
  console.log(`${items.length} fiches LOLUM.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
