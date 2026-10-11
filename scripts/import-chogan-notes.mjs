#!/usr/bin/env node
/**
 * Notes olfactives et familles des produits JAMAAL, à partir des pyramides officielles Chogan.
 *
 * Entrée  : import/chogan-notes.txt (id Chogan|code|Notes de tête§Notes de cœur§Notes de fond),
 *           relevé sur les fiches produit en français de chogangroupspa.com.
 * Sortie  : db/sql/20261011-11-notes-olfactives.sql (appliqué au déploiement, rejouable) et
 *           src/data/chogan-notes.json (même contenu, pour les tests et les imports futurs).
 *
 * - Les notes sont nettoyées (accents abîmés par le site, quelques termes restés en anglais) ;
 *   « Calamba » devient « Oud » (bois d'agar), le nom sous lequel les clients le cherchent.
 * - La famille olfactive est déduite des notes (Frais, Floral, Fruité, Gourmand, Boisé, Épicé,
 *   Oriental), la principale puis la seconde si elle pèse assez : « Floral fruité », « Boisé épicé »…
 * - Les gels douche et crèmes corps parfumés (BSF094, CRF007…) reprennent, en SQL, les notes du parfum
 *   de même numéro (094M, 007W…), seulement si les deux sont inspirés du même grand parfum.
 * - Le SQL ne remplace rien : il ne remplit que les produits sans notes ni famille, pour ne pas
 *   écraser une saisie faite au back-office.
 *
 * Usage : node scripts/import-chogan-notes.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "import/chogan-notes.txt");
const OUT_SQL = path.join(ROOT, "db/sql/20261011-11-notes-olfactives.sql");
const OUT_JSON = path.join(ROOT, "src/data/chogan-notes.json");

/** Termes à corriger (anglais, variantes du site) → libellé français. */
const RENAME = {
  "ozonic notes": "Notes ozoniques",
  "cacao butter": "Beurre de cacao",
  "hazelnut cocoa spread": "Pâte à tartiner noisette",
  "gourmand accord": "Accord gourmand",
  "black cherry": "Cerise noire",
  liquor: "Liqueur",
  smoke: "Fumée",
  skin: "Accord peau",
  "coconut powder": "Poudre de coco",
  "candied fruits": "Fruits confits",
  "jasmine orchid": "Orchidée jasmin",
  "red fruits": "Fruits rouges",
  "solar notes": "Notes solaires",
  "coconut pie": "Tarte à la noix de coco",
  "mysore sandalwood": "Santal de Mysore",
  "night blooming jasmine": "Jasmin de nuit",
  "desert peach": "Pêche du désert",
  amberwood: "Bois ambré",
  flint: "Pierre à fusil",
  bran: "Son de blé",
  "moepel accord": "Accord érable",
  calamba: "Oud",
  "bois de cedrat": "Bois de cèdre",
  lila: "Lilas",
  narcissus: "Narcisse",
  "fleur de wisteria": "Glycine",
  "huile essentielle de cypriol": "Cypriol",
  "notes épices": "Notes épicées",
  "fève tonka": "Fève tonka",
  "mousse végétale": "Mousse végétale",
  "pomme verte": "Pomme verte",
  "noix de coco": "Noix de coco",
  "ambrofix™": "Ambrofix",
};

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function cleanNote(raw) {
  const n = raw.replace(/�/g, "é").replace(/\s+/g, " ").trim();
  if (!n) return "";
  const fixed = RENAME[n.toLowerCase()];
  if (fixed) return fixed;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Familles et mots-clés (sans accents, en minuscules, recherche par inclusion). */
const FAMILIES = {
  Frais: ["bergamote", "citron", "mandarine", "orange", "pamplemousse", "yuzu", "bigarade", "neroli", "petit-grain", "tangerine", "agrumes",
    "lavande", "menthe", "romarin", "basilic", "sauge", "thym", "armoise", "verveine", "myrte", "eau de mer", "calone", "aquatique", "ozonique",
    "sel", "algue", "notes vertes", "feuille de figuier", "the", "genevrier", "genievre", "herbacee", "herbe", "estragon", "eucalyptus",
    "feuille de violette", "feuille de laurier", "camphre", "shiso", "aldehydes", "champagne", "bambou", "foin"],
  Floral: ["rose", "jasmin", "tubereuse", "fleur", "muguet", "iris", "pivoine", "ylang", "gardenia", "violette", "freesia", "magnolia", "lys",
    "orchidee", "heliotrope", "osmanthus", "geranium", "pelargonium", "lilas", "jacinthe", "nenuphar", "lotus", "frangipanier", "mimosa",
    "narcisse", "oeillet", "œillet", "cyclamen", "chevrefeuille", "glycine", "acacia", "amaryllis", "datura", "campanule", "hibiscus",
    "camomille", "aubepine", "souci", "pittosporum", "ambrette", "hedione", "davana"],
  Fruité: ["peche", "poire", "pomme", "framboise", "cassis", "fraise", "cerise", "griotte", "prune", "abricot", "ananas", "mangue", "melon",
    "fruit", "passiflore", "litchi", "papaye", "goyave", "pitaya", "mure", "groseille", "rhubarbe", "quandong", "figue"],
  Gourmand: ["vanille", "caramel", "praline", "tonka", "chocolat", "cacao", "cafe", "miel", "amande", "lait", "coco", "barbe a papa",
    "cassonade", "creme", "panna cotta", "pistache", "reglisse", "coumarine", "noisette", "tarte", "lactone", "noix", "riz", "cire d'abeille"],
  Boisé: ["cedre", "bois", "santal", "vetiver", "patchouli", "gaiac", "oud", "mousse de chene", "bouleau", "sapin", "pin", "cypres", "acajou",
    "palissandre", "cypriol", "iso e super", "papyrus", "mousse vegetale", "amyris", "palo santo", "teck", "maninka"],
  Épicé: ["poivre", "cannelle", "cardamome", "safran", "gingembre", "clou de girofle", "muscade", "piment", "anis", "badiane", "carvi",
    "coriandre", "cumin", "epice", "galanga"],
  Oriental: ["ambre", "ambroxan", "ambrofix", "benjoin", "ciste", "encens", "resine", "myrrhe", "oliban", "opoponax", "styrax", "baume",
    "baumier", "cuir", "daim", "suede", "tabac", "civette", "fumee", "cognac", "rhum", "liqueur", "sang", "elemi", "ferule", "serenolide"],
};
/** Adjectif de la famille secondaire. */
const SECOND = { Frais: "frais", Floral: "floral", Fruité: "fruité", Gourmand: "gourmand", Boisé: "boisé", Épicé: "épicé", Oriental: "oriental" };
const AQUATIC = ["eau de mer", "calone", "aquatique", "ozonique", "sel", "algue"];
/** Notes trop générales pour orienter la famille. */
const NEUTRAL = ["musc", "notes poudrees", "accord peau", "sable", "pierre a fusil", "orge", "son de ble", "accord erable", "cannabis", "maté", "mate", "campari", "notes solaires"];

/** Notes dont le nom trompe la recherche par mot-clé (« poivre rose » n'est pas une rose). */
const SPECIFIC = [
  ["poivre rose", "Épicé"],
  ["noix de muscade", "Épicé"],
  ["fleur d'oranger", "Floral"],
  ["essence de neroli", "Floral"],
  ["fleur de", "Floral"],
  ["feuille de", "Frais"],
  ["notes vertes", "Frais"],
  ["bois", "Boisé"],
];

function familiesOf(note) {
  const n = strip(note);
  if (NEUTRAL.some((k) => n.startsWith(strip(k)))) return [];
  const hit = SPECIFIC.find(([k]) => n.startsWith(k));
  if (hit) return [hit[1]];
  for (const f of Object.keys(FAMILIES)) {
    if (FAMILIES[f].some((k) => (k.length <= 4 ? new RegExp(`(^|[ '-])${k}([ '-]|$)`).test(n) : n.includes(k)))) return [f];
  }
  return [];
}

export function familyOf(top, heart, base) {
  const score = Object.fromEntries(Object.keys(FAMILIES).map((f) => [f, 0]));
  const add = (list, w) => list.forEach((note) => familiesOf(note).forEach((f) => (score[f] += w)));
  add(top, 1);
  add(heart, 1.3);
  add(base, 1.2);
  const ranked = Object.entries(score).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [[first, s1], second] = ranked;
  const aquatic = [...top, ...heart, ...base].some((n) => AQUATIC.some((k) => strip(n).includes(k)));
  if (second && second[1] >= 0.6 * s1) return `${first} ${SECOND[second[0]]}`;
  if (first === "Frais" && aquatic) return "Frais aquatique";
  return first;
}

export function parseLine(line) {
  const [id, code, rest] = line.split("|");
  const parts = { top: [], heart: [], base: [] };
  for (const seg of rest.split("§")) {
    const m = seg.match(/^Notes de (tête|cœur|fond)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1] === "tête" ? "top" : m[1] === "cœur" ? "heart" : "base";
    parts[key] = [...new Set(m[2].split(",").map(cleanNote).filter(Boolean))];
  }
  return { id: Number(id), code, ...parts, family: familyOf(parts.top, parts.heart, parts.base) };
}

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sqlArr = (a) => (a.length ? `ARRAY[${a.map(sqlStr).join(", ")}]::text[]` : `'{}'::text[]`);

function main() {
  const lines = fs.readFileSync(SRC, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const rows = lines.map(parseLine).filter((r) => r.top.length + r.heart.length + r.base.length > 0);

  const all = [...rows].sort((a, b) => a.id - b.id);
  const sql = [
    "-- Notes olfactives (tête, cœur, fond) et famille des produits, d'après les pyramides officielles Chogan.",
    "-- Généré par scripts/import-chogan-notes.mjs. Ne remplit que les produits sans notes ni famille :",
    "-- une saisie faite au back-office n'est jamais écrasée. Rejouable sans effet.",
    "",
    ...all.map(
      (r) =>
        `UPDATE "Product" SET "topNotes" = ${sqlArr(r.top)}, "heartNotes" = ${sqlArr(r.heart)}, "baseNotes" = ${sqlArr(r.base)}, ` +
        `"family" = COALESCE(NULLIF("family", ''), ${r.family ? sqlStr(r.family) : "NULL"}), "updatedAt" = NOW() ` +
        `WHERE "id" = 'chogan-${r.id}' AND coalesce(cardinality("topNotes"), 0) = 0 AND coalesce(cardinality("heartNotes"), 0) = 0 AND coalesce(cardinality("baseNotes"), 0) = 0;` +
        ` -- ${r.code}`
    ),
    "",
    "-- Gels douche et crèmes corps parfumés (BSF094, CRF007…) : notes et famille du parfum de même numéro",
    "-- (094M, 007W…), seulement si les deux sont inspirés du même grand parfum.",
    `UPDATE "Product" g SET "topNotes" = p."topNotes", "heartNotes" = p."heartNotes", "baseNotes" = p."baseNotes",`,
    `  "family" = COALESCE(NULLIF(g."family", ''), p."family"), "updatedAt" = NOW()`,
    `FROM "Product" p`,
    `WHERE g."choganCode" ~ '^(BSF|CRF)[0-9]{3}$'`,
    `  AND p."choganCode" ~ ('^' || substring(g."choganCode" from 4 for 3) || '[MWU]$')`,
    `  AND lower(trim(p."inspiredBy")) = lower(trim(g."inspiredBy"))`,
    `  AND coalesce(cardinality(p."topNotes"), 0) + coalesce(cardinality(p."heartNotes"), 0) + coalesce(cardinality(p."baseNotes"), 0) > 0`,
    `  AND coalesce(cardinality(g."topNotes"), 0) = 0 AND coalesce(cardinality(g."heartNotes"), 0) = 0 AND coalesce(cardinality(g."baseNotes"), 0) = 0;`,
    "",
  ].join("\n");
  fs.writeFileSync(OUT_SQL, sql);
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(all.map(({ id, code, family, top, heart, base }) => ({ id, code, family, top, heart, base })), null, 1) + "\n"
  );
  const fam = {};
  for (const r of all) fam[r.family ?? "—"] = (fam[r.family ?? "—"] ?? 0) + 1;
  console.log(`${all.length} pyramides Chogan.`);
  console.log(Object.entries(fam).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}: ${n}`).join(" · "));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
