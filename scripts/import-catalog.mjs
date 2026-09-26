#!/usr/bin/env node
/**
 * Importe le catalogue officiel CHOGAN (export CSV + dossier de photos que
 * l'utilisateur a récupérés depuis son espace consultant) et régénère
 * src/data/official-catalog.json, consommé par src/data/products.ts.
 *
 * Usage : npm run import:catalog
 * Entrée attendue :
 *   - import/products.csv   (voir import/products.template.csv pour le format)
 *   - import/photos/*.jpg   (fichiers référencés par la colonne "photo" du CSV)
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "import", "products.csv");
const photosDir = path.join(root, "import", "photos");
const publicProduitsDir = path.join(root, "public", "produits");
const outputPath = path.join(root, "src", "data", "official-catalog.json");

const VALID_CATEGORIES = new Set([
  "parfum-femme",
  "parfum-homme",
  "parfum-unisexe",
  "aurodhea",
  "lolum",
  "maquillage",
  "bijoux",
  "entretien-maison",
  "parfum-ambiance",
  "complement-alimentaire",
  "autres-produits",
]);

const GRADIENTS = [
  ["#16233a", "#c9997a"],
  ["#24374f", "#e4c4ab"],
  ["#a97557", "#16233a"],
  ["#c9997a", "#16233a"],
  ["#1b2a41", "#d9b08c"],
  ["#3a2c22", "#c9997a"],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      if (field.length || row.length) pushRow();
    } else if (c === "\r") {
      // ignore, \n handles the row break
    } else {
      field += c;
    }
  }
  if (field.length || row.length) pushRow();
  return rows;
}

function slugify(str) {
  return str
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function splitList(value) {
  if (!value) return undefined;
  const items = value
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function splitParagraphs(value) {
  if (!value) return [];
  return value
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function main() {
  if (!existsSync(csvPath)) {
    console.error(
      `\nAucun fichier trouvé : import/products.csv\n` +
        `→ Copiez import/products.template.csv vers import/products.csv, remplissez-le avec\n` +
        `  votre catalogue officiel, placez vos photos dans import/photos/, puis relancez :\n` +
        `  npm run import:catalog\n`
    );
    process.exit(1);
  }

  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length < 2) {
    console.error("Le fichier import/products.csv ne contient aucune ligne de données.");
    process.exit(1);
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (col) => header.indexOf(col);

  const required = ["name", "category"];
  for (const col of required) {
    if (idx(col) === -1) {
      console.error(`Colonne obligatoire manquante dans le CSV : "${col}"`);
      process.exit(1);
    }
  }

  mkdirSync(publicProduitsDir, { recursive: true });

  const products = [];
  const warnings = [];

  rows.slice(1).forEach((cols, i) => {
    const get = (col) => {
      const j = idx(col);
      return j === -1 ? "" : (cols[j] ?? "").trim();
    };

    const name = get("name");
    const category = get("category");
    if (!name || !category) return;

    if (!VALID_CATEGORIES.has(category)) {
      warnings.push(
        `Ligne ${i + 2} : catégorie inconnue "${category}" (valeurs possibles : ${[...VALID_CATEGORIES].join(", ")}) — ligne ignorée.`
      );
      return;
    }

    const number = toNumber(get("number"));
    const slug = slugify(get("slug") || (number !== undefined ? `jamaal-n-${number}` : name));
    const [colorFrom, colorTo] = GRADIENTS[products.length % GRADIENTS.length];

    let photo;
    const photoFile = get("photo");
    if (photoFile) {
      const src = path.join(photosDir, photoFile);
      if (existsSync(src)) {
        const ext = path.extname(photoFile) || ".jpg";
        const destName = `${slug}${ext}`;
        copyFileSync(src, path.join(publicProduitsDir, destName));
        photo = `/produits/${destName}`;
      } else {
        warnings.push(`Ligne ${i + 2} : photo introuvable "${photoFile}" dans import/photos/ — placeholder utilisé.`);
      }
    }

    const testerPrice = toNumber(get("tester_price"));
    const price30 = toNumber(get("price_30ml"));
    const price70 = toNumber(get("price_70ml"));
    const regularPrice = toNumber(get("regular_price"));

    const volumes = [];
    if (testerPrice !== undefined) volumes.push({ label: "Échantillon 3 ml", price: testerPrice });
    if (price30 !== undefined) volumes.push({ label: "30 ml", price: price30 });
    if (price70 !== undefined) volumes.push({ label: "70 ml", price: price70 });

    const longDescription = splitParagraphs(get("description"));

    products.push({
      id: `official-${slug}`,
      number,
      slug,
      name,
      category,
      family: get("family") || undefined,
      topNotes: splitList(get("top_notes")),
      heartNotes: splitList(get("heart_notes")),
      baseNotes: splitList(get("base_notes")),
      shortDescription: longDescription[0] ?? name,
      longDescription: longDescription.length ? longDescription : [name],
      testerPrice,
      volumes: volumes.length ? volumes : undefined,
      regularPrice: regularPrice ?? (volumes.length ? undefined : price30 ?? price70),
      reviewCount: toNumber(get("review_count")) ?? 0,
      rating: toNumber(get("rating")) ?? 4.5,
      colorFrom,
      colorTo,
      photo,
      isOfficial: true,
    });
  });

  writeFileSync(outputPath, JSON.stringify(products, null, 2) + "\n", "utf8");

  console.log(`\n✓ ${products.length} produit(s) officiel(s) importé(s) dans src/data/official-catalog.json`);
  const byCategory = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});
  Object.entries(byCategory).forEach(([cat, count]) => console.log(`  - ${cat} : ${count}`));

  if (warnings.length) {
    console.log("\nAvertissements :");
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }

  console.log(
    "\nCatégories non couvertes par votre import gardent le catalogue de démonstration.\n" +
      "Relancez `npm run build` (ou `npm run dev`) pour voir le résultat.\n"
  );
}

main();
