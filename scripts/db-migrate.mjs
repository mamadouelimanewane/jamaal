#!/usr/bin/env node
/**
 * Mise à jour automatique de la base au déploiement.
 *
 * Applique, dans l'ordre alphabétique, chaque fichier de db/sql/*.sql qui n'a pas encore été
 * appliqué, et l'enregistre dans la table "_jamaal_sql" (nom + empreinte). Un fichier déjà
 * appliqué n'est jamais rejoué ; s'il a été modifié depuis, le déploiement s'arrête (on ne
 * réécrit pas l'histoire : créer un nouveau fichier à la place).
 *
 * - Lancé par `npm run build` sur Vercel (variable VERCEL=1), y compris pour les
 *   prévisualisations : les scripts doivent donc être additifs et rejouables (IF NOT EXISTS…).
 * - En local, il ne fait rien sauf avec `npm run db:migrate` (ou DB_MIGRATE=1).
 * - En cas d'erreur, tout le fichier est annulé et le build échoue : la production en ligne
 *   n'est pas remplacée.
 *
 * Les anciens scripts de import/neon/ (déjà appliqués à la main) ne sont PAS concernés.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";
import "dotenv/config"; // en local : lit DATABASE_URL dans .env (sur Vercel, variables déjà présentes)

const enabled = process.env.VERCEL === "1" || process.env.DB_MIGRATE === "1" || process.argv.includes("--run");
if (!enabled) {
  console.log("[db-migrate] ignoré (ni Vercel, ni DB_MIGRATE=1).");
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("[db-migrate] DATABASE_URL manquant : impossible de mettre la base à jour.");
  process.exit(1);
}

const dir = path.resolve("db/sql");
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort() : [];
if (!files.length) {
  console.log("[db-migrate] aucun script dans db/sql.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
// Verrou consultatif de transaction (compatible avec le pooler Neon) : deux builds simultanés
// ne peuvent pas appliquer le même script.
const LOCK_ID = 727_272;

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
  await client.query(`CREATE TABLE IF NOT EXISTS "_jamaal_sql" (
    "name" TEXT PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.query("COMMIT");
  const { rows } = await client.query(`SELECT "name", "checksum" FROM "_jamaal_sql"`);
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  let count = 0;
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = applied.get(file);
    if (previous) {
      if (previous !== checksum) {
        throw new Error(`${file} a déjà été appliqué mais son contenu a changé. Créez un nouveau fichier plutôt que de le modifier.`);
      }
      continue;
    }
    console.log(`[db-migrate] application de ${file}…`);
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
      // Un autre build l'a peut-être appliqué pendant qu'on attendait le verrou.
      const again = await client.query(`SELECT 1 FROM "_jamaal_sql" WHERE "name" = $1`, [file]);
      if (again.rowCount) {
        await client.query("ROLLBACK");
        continue;
      }
      await client.query(sql);
      await client.query(`INSERT INTO "_jamaal_sql" ("name", "checksum") VALUES ($1, $2)`, [file, checksum]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${file} : ${error.message}`);
    }
    count += 1;
  }
  console.log(count ? `[db-migrate] ${count} script(s) appliqué(s).` : "[db-migrate] base déjà à jour.");
} catch (error) {
  console.error(`[db-migrate] ÉCHEC — ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
