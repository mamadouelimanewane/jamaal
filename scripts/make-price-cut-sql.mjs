#!/usr/bin/env node
/**
 * Génère import/neon/6-baisse-prix-catalogue-existant.sql : baisse de 20 % des prix
 * des produits d'origine (src/data/official-catalog.json), à coller dans Neon > SQL Editor.
 *
 * Idempotent : chaque produit reçoit son prix final EXACT calculé depuis le catalogue
 * de référence (jamais « prix actuel × 0,8 »), donc on peut le rejouer sans baisser deux fois.
 * Les volumes (JSON) sont mis à jour en même temps que regularPrice / testerPrice pour que
 * la validation des prix à la commande reste cohérente.
 * Usage : REMISE=0.2 node scripts/make-price-cut-sql.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const REMISE = Number(process.env.REMISE ?? 0.2);
const cut = (n) => (n == null ? null : Math.max(50, Math.round((n * (1 - REMISE)) / 50) * 50));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const products = JSON.parse(readFileSync("src/data/official-catalog.json", "utf8"));
const rows = products.map((p) => {
  const volumes = p.volumes ? p.volumes.map((v) => ({ label: v.label, price: cut(v.price) })) : null;
  return `(${q(p.slug)}, ${cut(p.testerPrice) ?? "NULL"}, ${cut(p.regularPrice) ?? "NULL"}, ${volumes ? q(JSON.stringify(volumes)) : "NULL"})`;
});

const sql = [
  `-- Baisse de ${Math.round(REMISE * 100)} % des prix du catalogue d'origine (${products.length} produits). Rejouable sans risque.`,
  'UPDATE "Product" AS p SET',
  '  "testerPrice" = v.tester,',
  '  "regularPrice" = v.regular,',
  '  "volumes" = v.volumes::jsonb,',
  '  "updatedAt" = now()',
  "FROM (VALUES",
  rows.join(",\n"),
  ") AS v(slug, tester, regular, volumes)",
  "WHERE p.slug = v.slug;",
  "",
].join("\n");

writeFileSync("import/neon/6-baisse-prix-catalogue-existant.sql", sql);
console.log(`${products.length} produits, fichier import/neon/6-baisse-prix-catalogue-existant.sql (${sql.length} octets)`);
