#!/usr/bin/env node
/**
 * Génère src/data/chogan-catalog.json à partir de import/chogan-raw.txt
 * (export du catalogue public Chogan : id|catégorie|prix €|format|image|nom).
 *
 * Le catalogue du site est 100 % Chogan : un produit du site = un produit Chogan
 * (identifiant, nom, format et photo viennent tels quels du site Chogan).
 *
 * - Prix public Chogan en FCFA = prix public € × 655,957 (champ publicPrice).
 * - Prix de vente JAMAAL = prix public FCFA × VENTE % (125 % par défaut), arrondi à 100 FCFA.
 *   En production, le pourcentage se règle dans Admin > Modèle économique, qui recalcule les prix.
 * - Images : CDN Chogan (démo). À remplacer par vos propres fichiers pour la production.
 *
 * Usage : node scripts/import-chogan.mjs   (VENTE=125 par défaut)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EUR_XOF = 655.957;
// Prix de vente en % du prix public Chogan (modèle économique : prix public + 25 %).
const VENTE = Number(process.env.VENTE ?? 125);
const CDN = "https://cdn.chogangroupspa.com/images/prodotti/big/";

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s) => norm(s).replace(/\s+/g, "-").slice(0, 60).replace(/-$/, "");
const publicXof = (eur) => Math.round(eur * EUR_XOF);
const priceXof = (eur) => Math.max(100, Math.round((publicXof(eur) * VENTE) / 100 / 100) * 100);

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

const rows = readFileSync(path.join(root, "import/chogan-raw.txt"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [id, leaf, eur, format, img, ...rest] = l.split("|");
    return { id, leaf, eur: Number(eur), format: format.trim(), img, name: rest.join("|").trim() };
  });

const nameCount = new Map();
for (const r of rows) nameCount.set(norm(r.name), (nameCount.get(norm(r.name)) ?? 0) + 1);

const out = rows.map((r) => {
  const dup = nameCount.get(norm(r.name)) > 1;
  const name = (dup ? `${r.name} — réf. ${r.id}` : r.name).replace(/\s+/g, " ");
  const detail = r.format ? ` Format : ${r.format}.` : "";
  return {
    id: `chogan-${r.id}`,
    slug: `${slugify(r.name)}-${r.id}`,
    name,
    category: categorize(r.leaf, r.name),
    shortDescription: `${r.name}${r.format ? ` — ${r.format}` : ""}. Produit Chogan, distribué au Sénégal par JAMAAL.`,
    longDescription: [
      `${r.name}.${detail}`,
      "Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, représentant exclusif.",
    ],
    publicPrice: publicXof(r.eur),
    regularPrice: priceXof(r.eur),
    reviewCount: 0,
    rating: 4.6,
    colorFrom: "#1d2f4f",
    colorTo: "#d9a99d",
    photo: `${CDN}${r.img}`,
    isOfficial: true,
  };
});

writeFileSync(path.join(root, "src/data/chogan-catalog.json"), JSON.stringify(out, null, 1) + "\n");
const byCat = out.reduce((a, p) => ((a[p.category] = (a[p.category] ?? 0) + 1), a), {});
console.log(`${out.length} produits Chogan générés.`);
console.log(byCat);
