#!/usr/bin/env node
/**
 * Génère import/neon/8-modele-economique.sql, à coller dans Neon > SQL Editor si
 * `npx prisma migrate deploy` ne peut pas joindre la base (port 5432 bloqué).
 *
 * - applique les migrations RateLimitBucket et Product.publicPrice (une seule fois) ;
 * - renseigne le prix public Chogan (FCFA) des produits à partir de src/data/chogan-catalog.json.
 * Le script peut être rejoué sans risque. Les prix de vente ne changent pas ici :
 * utilisez ensuite Admin > Modèle économique > « Mettre à jour les prix ».
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

// La base Neon peut ne pas avoir de table _prisma_migrations (schéma créé par SQL) :
// on utilise donc des instructions idempotentes (IF NOT EXISTS) plutôt que l'historique Prisma.
const migrations = ["20261008010000_rate_limit_buckets", "20261008020000_product_public_price"];
let sql = "-- 8) Modèle économique : tables/colonnes + prix publics Chogan (rejouable)\nBEGIN;\n\n";
sql += `-- Limitation de débit partagée (lot 2)
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- Prix public Chogan (lot 3)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publicPrice" INTEGER;

`;
// Si la base suit l'historique Prisma, on y inscrit aussi ces migrations (sinon on ne fait rien).
for (const name of migrations) {
  const body = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").replace(/\r\n/g, "\n");
  const checksum = createHash("sha256").update(body).digest("hex");
  // EXECUTE : la table n'est lue que si elle existe (PL/pgSQL valide sinon toute la requête).
  sql += `DO $mig$ BEGIN
  IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
      SELECT '${randomUUID()}','${checksum}',now(),'${name}',NULL,NULL,now(),1
      WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '${name}')$q$;
  END IF;
END $mig$;
`;
}
sql += "\n";

const catalog = JSON.parse(readFileSync("src/data/chogan-catalog.json", "utf8"));
const rows = catalog.filter((p) => p.publicPrice > 0).map((p) => `('${p.id.replace(/'/g, "''")}', ${p.publicPrice})`);
sql += `-- Prix public Chogan (FCFA) de ${rows.length} produits\nUPDATE "Product" AS p SET "publicPrice" = v.price, "updatedAt" = now()\nFROM (VALUES\n${rows.join(",\n")}\n) AS v(id, price)\nWHERE p."id" = v.id;\n\nCOMMIT;\n`;

writeFileSync("import/neon/8-modele-economique.sql", sql);
console.log(`import/neon/8-modele-economique.sql : ${rows.length} prix publics`);
