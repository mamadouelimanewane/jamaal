#!/usr/bin/env node
/**
 * Fiches Ligne Solaire Aurodhea / Tribe : description et mode d'emploi, d'après le catalogue
 * « Linea Solari Tribe » (PDF Aurodhea/Chogan), traduits en français dans
 * import/aurodhea-solaire-catalogue.json.
 *
 * Sortie : db/sql/20261011-14-fiches-tribe-solaire.sql (rejouable sans effet).
 * Ne remplace que les textes générés automatiquement à l'import du catalogue Chogan (deux formats
 * rencontrés en base selon le lot d'import : « … Produit Chogan, distribué au Sénégal par
 * JAMAAL. » / description longue vide, et « … Produit Chogan. » / « … Produit officiel Chogan. »
 * pour les lots plus anciens) : une fiche réécrite au back-office est conservée.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const items = JSON.parse(fs.readFileSync(path.join(ROOT, "import/aurodhea-solaire-catalogue.json"), "utf8"));

export const CAUTIONS = {
  sun: "Précautions : usage externe ; éviter le contact avec les yeux ; ne remplace pas une protection vestimentaire adaptée ni une exposition solaire raisonnée. Ne remplace pas un avis médical.",
  cosmetic:
    "Précautions : usage externe ; éviter le contact avec les yeux ; faire un essai sur une petite zone de peau avant la première utilisation. Ne remplace pas un avis médical.",
  insect:
    "Précautions : usage externe ; éviter le contact avec les yeux et les muqueuses ; ne pas appliquer sur une peau lésée ; tenir hors de portée des enfants. Ne remplace pas un avis médical en cas de piqûre ou de réaction allergique.",
  firstAid:
    "Précautions : usage externe ; éviter le contact avec les yeux ; en cas de plaie profonde, de brûlure étendue ou de signe d'infection, consulter un médecin. Ne remplace pas un avis médical.",
  serum:
    "Précautions : usage externe ; éviter le contact avec les yeux ; déconseillé pendant la grossesse et l'allaitement sans avis médical ; faire un essai sur une petite zone de peau avant la première utilisation. Les résultats varient selon les personnes. Ne remplace pas un avis médical.",
};

export function shortOf(p) {
  return p.short;
}

export function longOf(p) {
  return [...p.long, CAUTIONS[p.caution]];
}

const s = (v) => `'${String(v).replace(/'/g, "''")}'`;
const arr = (a) => `ARRAY[${a.map(s).join(", ")}]::text[]`;

// Deux générations de description générique coexistent en base selon le lot d'import d'origine.
const SHORT_PLACEHOLDER = `("shortDescription" LIKE '%Produit Chogan, distribué au Sénégal par JAMAAL.' OR "shortDescription" LIKE '%Produit Chogan.')`;
const LONG_PLACEHOLDER =
  `(coalesce(cardinality("longDescription"), 0) = 0 OR (cardinality("longDescription") <= 2 AND ` +
  `(array_to_string("longDescription", ' ') LIKE '%distribué au Sénégal par JAMAAL%' OR ` +
  `array_to_string("longDescription", ' ') LIKE '%Produit officiel Chogan%')))`;

function main() {
  const lines = [
    "-- Fiches Ligne Solaire Aurodhea / Tribe (catalogue Linea Solari Tribe, Chogan).",
    "-- Généré par scripts/import-tribe-solaire.mjs. Ne remplace que les textes générés automatiquement :",
    "-- une fiche réécrite au back-office est conservée. Rejouable sans effet.",
    "",
  ];
  for (const p of items) {
    lines.push(
      `UPDATE "Product" SET "shortDescription" = ${s(shortOf(p))}, "updatedAt" = NOW() ` +
        `WHERE "choganCode" = ${s(p.code)} AND ${SHORT_PLACEHOLDER};`,
      `UPDATE "Product" SET "longDescription" = ${arr(longOf(p))}, "updatedAt" = NOW() ` +
        `WHERE "choganCode" = ${s(p.code)} AND ${LONG_PLACEHOLDER};`
    );
  }
  lines.push("");
  fs.writeFileSync(path.join(ROOT, "db/sql/20261011-14-fiches-tribe-solaire.sql"), lines.join("\n"));
  console.log(`${items.length} fiches Ligne Solaire Aurodhea / Tribe.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
