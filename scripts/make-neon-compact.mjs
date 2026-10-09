#!/usr/bin/env node
/**
 * SQL compact pour Neon (SQL Editor) : met la base à jour vers le catalogue Chogan complet
 * en n'insérant QUE les produits Chogan absents de la base de production.
 *
 *   import/neon/A-ajouter-produits-manquants.sql   (INSERT des produits absents)
 *   import/neon/B-supprimer-anciens-produits.sql   (supprime les produits non-Chogan)
 *
 * Les produits déjà en base sont reconnus par leur identifiant (chogan-<id>) : il suffit de
 * donner en argument le commit dont le catalogue correspond à l'état actuel de la base.
 * Usage : node scripts/make-neon-compact.mjs <commit-de-reference>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ref = process.argv[2] ?? "1beabb9";
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const current = JSON.parse(readFileSync("src/data/chogan-catalog.json", "utf8"));
const inDb = new Set(JSON.parse(execSync(`git show ${ref}:src/data/chogan-catalog.json`, { encoding: "utf8", maxBuffer: 1 << 26 })).map((p) => p.id));
const missing = current.filter((p) => !inDb.has(p.id));

const CDN = "https://cdn.chogangroupspa.com/images/prodotti/big/";
const rawFormat = new Map(
  readFileSync("import/chogan-raw.txt", "utf8").split("\n").filter(Boolean).map((l) => {
    const [id, , , format] = l.split("|");
    return [`chogan-${id}`, format.trim()];
  })
);

const rows = missing.map((p) => `(${q(p.id)},${q(p.slug)},${q(p.name)},${q(p.category)},${p.regularPrice},${q(p.photo.replace(CDN, ""))},${q(rawFormat.get(p.id) ?? "")})`);

const sql = [
  `-- Ajoute ${missing.length} produits Chogan absents de la base (les produits déjà présents sont ignorés).`,
  "INSERT INTO \"Product\" (\"id\",\"slug\",\"name\",\"category\",\"topNotes\",\"heartNotes\",\"baseNotes\",\"shortDescription\",\"longDescription\",\"regularPrice\",\"reviewCount\",\"rating\",\"colorFrom\",\"colorTo\",\"photo\",\"isOfficial\",\"stock\",\"lowStockThreshold\",\"updatedAt\")",
  "SELECT v.id, v.slug, v.name, v.cat, '{}'::text[], '{}'::text[], '{}'::text[],",
  "  base.n || CASE WHEN v.fmt <> '' THEN ' — ' || v.fmt ELSE '' END || '. Produit Chogan, distribué au Sénégal par JAMAAL.',",
  "  ARRAY[base.n || '.' || CASE WHEN v.fmt <> '' THEN ' Format : ' || v.fmt || '.' ELSE '' END, 'Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN (Italie).'],",
  "  v.price, 0, 4.6, '#1d2f4f', '#d9a99d', '" + CDN + "' || v.img, true, 25, 5, now()",
  "FROM (VALUES",
  rows.join(",\n"),
  ") AS v(id, slug, name, cat, price, img, fmt)",
  "CROSS JOIN LATERAL (SELECT regexp_replace(v.name, ' — réf\\. [0-9]+$', '') AS n) AS base",
  'ON CONFLICT ("slug") DO NOTHING;',
  "",
].join("\n");
writeFileSync("import/neon/A-ajouter-produits-manquants.sql", sql);

writeFileSync(
  "import/neon/B-supprimer-anciens-produits.sql",
  [
    "-- Supprime les produits du catalogue d'origine : il ne reste que la gamme Chogan (identifiants chogan-…).",
    "-- Les commandes passées sont conservées (le nom du produit reste sur la ligne de commande).",
    "DELETE FROM \"Product\" WHERE \"id\" NOT LIKE 'chogan-%';",
    "",
  ].join("\n")
);
console.log(`${missing.length} produits à ajouter, ${sql.length} octets`);
