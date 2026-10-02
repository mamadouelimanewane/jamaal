#!/usr/bin/env node
/**
 * Génère des fichiers SQL à coller dans Neon > SQL Editor (alternative à
 * `prisma migrate deploy` + `npm run db:seed` quand le port 5432 est bloqué).
 * Sortie : import/neon/*.sql
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

const q = (s) => (s == null ? "NULL" : "'" + String(s).replace(/'/g, "''") + "'");
const arr = (a) => (a && a.length ? "ARRAY[" + a.map(q).join(",") + "]::text[]" : "ARRAY[]::text[]");

mkdirSync("import/neon", { recursive: true });

// Migration (contenu tel que commité, fins de ligne LF) + enregistrement dans _prisma_migrations
const migPath = "prisma/migrations/20261002010000_consultant_applications/migration.sql";
const mig = execSync(`git show HEAD:${migPath}`, { encoding: "utf8" }).replace(/\r\n/g, "\n");
const checksum = createHash("sha256").update(mig).digest("hex");

// Catégories : on évalue le tableau du fichier TypeScript sans ses types.
const src = readFileSync("src/data/categories.ts", "utf8");
const body = src.slice(src.indexOf("export const categories"), src.indexOf("export function getCategory"));
const cats = new Function(body.replace(/export const categories: Category\[\] =/, "return ").replace(/;\s*$/, ""))();

let s1 = "-- 1) Migration candidatures + catégories (à coller dans Neon > SQL Editor)\nBEGIN;\n" + mig + "\n";
s1 += `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count") VALUES ('${randomUUID()}','${checksum}',now(),'20261002010000_consultant_applications',NULL,NULL,now(),1);\n`;
s1 += "-- Catégories (ne crée que celles qui manquent)\n";
cats.forEach((c, i) => {
  s1 += `INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-${c.slug}',${q(c.slug)},${q(c.label)},${q(c.navLabel)},${q(c.description)},${q(c.accent)},${i} WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"=${q(c.slug)});\n`;
});
s1 += "COMMIT;\n";
writeFileSync("import/neon/1-migration-et-categories.sql", s1);

const prods = JSON.parse(readFileSync("src/data/chogan-catalog.json", "utf8"));
const per = 160;
let n = 1;
for (let i = 0; i < prods.length; i += per) {
  const chunk = prods.slice(i, i + per);
  n++;
  let s = `-- ${n}) Produits ${i + 1}-${i + chunk.length} sur ${prods.length}\n`;
  s += 'INSERT INTO "Product" ("id","slug","name","category","topNotes","heartNotes","baseNotes","shortDescription","longDescription","regularPrice","reviewCount","rating","colorFrom","colorTo","photo","isOfficial","stock","lowStockThreshold","updatedAt") VALUES\n';
  s += chunk
    .map((p) => `(${q(p.id)},${q(p.slug)},${q(p.name)},${q(p.category)},ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],${q(p.shortDescription)},${arr(p.longDescription)},${p.regularPrice},${p.reviewCount},${p.rating},${q(p.colorFrom)},${q(p.colorTo)},${q(p.photo)},true,25,5,now())`)
    .join(",\n");
  s += '\nON CONFLICT ("slug") DO NOTHING;\n';
  writeFileSync(`import/neon/${n}-produits.sql`, s);
}
// Mise à jour des prix (idempotente : fixe le prix exact de chaque produit Chogan)
const priceRows = prods.map((p) => `(${q(p.id)}, ${p.regularPrice})`).join(",\n");
writeFileSync(
  "import/neon/5-mise-a-jour-prix.sql",
  [
    "-- Met à jour les prix des produits Chogan (peut être rejoué sans risque)",
    'UPDATE "Product" AS p SET "regularPrice" = v.price, "updatedAt" = now()',
    "FROM (VALUES",
    priceRows,
    ") AS v(id, price)",
    "WHERE p.id = v.id;",
    "",
  ].join("\n")
);
console.log(`${cats.length} catégories, ${prods.length} produits, ${n} fichiers`);
for (const f of readdirSync("import/neon")) console.log(f, statSync("import/neon/" + f).size, "octets");
