#!/usr/bin/env node
/**
 * Génère src/data/chogan-catalog.json à partir de import/chogan-raw.txt
 * (export du catalogue public Chogan : id|catégorie|prix €|format|image|nom).
 *
 * - Prix de vente en FCFA = prix public € × 655,957 × (1 + MARGE) × (1 − REMISE), arrondi à 100 FCFA.
 * - Les produits déjà présents dans src/data/official-catalog.json (même nom,
 *   ou nom cité dans leur description) ne sont pas dupliqués.
 * - Images : CDN Chogan (démo). À remplacer par vos propres fichiers pour la prod.
 *
 * Usage : node scripts/import-chogan.mjs   (MARGE=0.2 par défaut)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EUR_XOF = 655.957;
const MARGE = Number(process.env.MARGE ?? 0.2);
// Remise appliquée ensuite sur le prix majoré (20 % par défaut).
const REMISE = Number(process.env.REMISE ?? 0.2);
const CDN = "https://cdn.chogangroupspa.com/images/prodotti/big/";

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s) => norm(s).replace(/\s+/g, "-").slice(0, 60).replace(/-$/, "");
const priceXof = (eur) => Math.max(100, Math.round((eur * EUR_XOF * (1 + MARGE) * (1 - REMISE)) / 100) * 100);

const existing = JSON.parse(readFileSync(path.join(root, "src/data/official-catalog.json"), "utf8"));
const existingNames = new Set(existing.map((p) => norm(p.name)));
const existingText = norm(existing.map((p) => `${p.name} ${p.shortDescription}`).join(" "));

/** Catégorie JAMAAL à partir de la catégorie Chogan (leaf) et du nom. */
function categorize(leaf, name) {
  const n = norm(name);
  if (/chien|tiques|animaux/.test(n)) return "animaux";
  if (leaf === "460") {
    if (/\bfemme\b|for her|woman/.test(n)) return "parfum-femme";
    if (/\bhomme\b|for him|\bman\b/.test(n)) return "parfum-homme";
    return "parfum-unisexe";
  }
  if (/skinail|complement/.test(n) && !["513", "581"].includes(leaf)) return "complement-alimentaire";
  if (/bril|clean/.test(n) && ["433"].includes(leaf)) return "entretien-maison";
  if (/solaire/.test(n) && leaf === "433") return "soleil";
  const map = {
    464: "gels-douche", 463: "cremes-corps", 530: "etuis-parfum",
    434: "soins-corps", 435: /lollilip|masque levres/.test(n) ? "maquillage" : "soins-visage", 436: "soins-cheveux", 438: "soleil",
    437: "remedes-onguents", 566: "accessoires", 473: /bague|bijou/.test(n) ? "bijoux" : "accessoires",
    449: "maquillage", 450: "maquillage", 451: "maquillage", 556: "maquillage",
    453: "lolum", 454: "lolum", 561: "lolum",
    433: "complement-alimentaire",
    581: "nutrition-sport", 512: "substituts-repas", 513: "complement-alimentaire", 517: "complement-alimentaire",
    519: "complement-alimentaire", 520: "complement-alimentaire", 521: "complement-alimentaire",
    538: "accessoires", 525: "cafe-boissons",
    503: "parfum-ambiance", 504: "parfum-ambiance", 576: "parfum-ambiance",
    495: "entretien-maison", 496: "entretien-maison", 497: "entretien-maison", 498: "entretien-maison",
    499: "entretien-maison", 500: "entretien-maison", 501: "entretien-maison", 502: "entretien-maison",
  };
  return map[leaf] ?? "autres-produits";
}

/** Nom court d'un parfum (« Prestige for Him Parfum homme » → « prestige for him »). */
const perfumeCore = (name) =>
  norm(name.replace(/\s*[–-]\s*(parfum|extrait|profumo).*$/i, "").replace(/\s+parfum.*$/i, "").replace(/\s+extrait.*$/i, ""));

const rows = readFileSync(path.join(root, "import/chogan-raw.txt"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [id, leaf, eur, format, img, ...rest] = l.split("|");
    return { id, leaf, eur: Number(eur), format: format.trim(), img, name: rest.join("|").trim() };
  });

const nameCount = new Map();
for (const r of rows) nameCount.set(norm(r.name), (nameCount.get(norm(r.name)) ?? 0) + 1);

const skipped = [];
// Images déjà associées à un produit existant (scripts/map-photos.mjs) : même article, on ne le réimporte pas.
const fallbackPath = path.join(root, "src/data/photo-fallback.json");
const usedByExisting = new Set(
  existsSync(fallbackPath) ? Object.values(JSON.parse(readFileSync(fallbackPath, "utf8"))).map((u) => u.split("/").pop()) : []
);
const droppedIds = [];
const out = [];
for (const r of rows) {
  const category = categorize(r.leaf, r.name);
  if (r.leaf === "460") {
    const core = perfumeCore(r.name);
    if (core.length > 3 && existingText.includes(core)) { skipped.push(r.name); continue; }
  } else if (existingNames.has(norm(r.name))) { skipped.push(r.name); continue; }
  // Même photo qu'un produit existant = même article : on ne le réimporte pas (et on le retire de la base s'il y est).
  if (usedByExisting.has(r.img)) { droppedIds.push(`chogan-${r.id}`); skipped.push(r.name); continue; }

  const dup = nameCount.get(norm(r.name)) > 1;
  const name = (dup ? `${r.name} — réf. ${r.id}` : r.name).replace(/\s+/g, " ");
  const price = priceXof(r.eur);
  const detail = r.format ? ` Format : ${r.format}.` : "";
  out.push({
    id: `chogan-${r.id}`,
    slug: `${slugify(r.name)}-${r.id}`,
    name,
    category,
    shortDescription: `${r.name}${r.format ? ` — ${r.format}` : ""}. Produit Chogan, distribué au Sénégal par JAMAAL.`,
    longDescription: [
      `${r.name}.${detail}`,
      "Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, représentant exclusif.",
    ],
    regularPrice: price,
    reviewCount: 0,
    rating: 4.6,
    colorFrom: "#1d2f4f",
    colorTo: "#d9a99d",
    photo: `${CDN}${r.img}`,
    isOfficial: true,
  });
}

writeFileSync(path.join(root, "src/data/chogan-catalog.json"), JSON.stringify(out, null, 1) + "\n");
// SQL pour retirer de la base les doublons déjà importés (même photo qu'un produit existant).
if (droppedIds.length) {
  const lines = [
    `-- Supprime ${droppedIds.length} produits Chogan importés en double d'un produit déjà au catalogue.`,
    "-- (les produits déjà commandés sont conservés)",
    'DELETE FROM "Product" WHERE "id" IN (',
    droppedIds.map((i) => `  '${i}'`).join(",\n"),
    ') AND NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."productId" = "Product"."id");',
    "",
  ];
  writeFileSync(path.join(root, "import/neon/7-supprimer-doublons.sql"), lines.join("\n"));
}
const byCat = out.reduce((a, p) => ((a[p.category] = (a[p.category] ?? 0) + 1), a), {});
console.log(`${out.length} produits générés, ${skipped.length} déjà présents ignorés.`);
console.log(byCat);
