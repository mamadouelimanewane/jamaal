/**
 * Limitation de débit partagée entre toutes les instances (table RateLimitBucket en base).
 *
 * Sur Vercel chaque requête peut tomber sur une instance différente : un compteur en mémoire
 * ne protège donc presque rien. Le compteur est stocké en Postgres et incrémenté de façon
 * atomique. Si la table n'existe pas encore (migration non appliquée) ou si la base ne répond
 * pas, on retombe sur le compteur en mémoire : le site continue de fonctionner.
 *
 * Usage :
 *   const limited = await rateLimit(`order:${ip}`, { limit: 5, windowMs: 60_000 });
 *   if (!limited.ok) throw new Error("Trop de tentatives, réessayez dans une minute.");
 */

import { prisma } from "@/lib/prisma";

type Entry = { count: number; resetAt: number };
type Result = { ok: boolean; remaining: number; retryAfterSec: number };
type Options = { limit: number; windowMs: number };

const store = new Map<string, Entry>();

function toResult(count: number, resetAt: number, limit: number, now: number): Result {
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: Math.max(0, Math.ceil((resetAt - now) / 1000)),
  };
}

/** Compteur local à l'instance (secours). */
export function rateLimitInMemory(key: string, opts: Options): Result {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, entry);
  }
  entry.count += 1;

  // Nettoyage opportuniste (évite une fuite mémoire trop importante)
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.resetAt <= now) store.delete(k);
    }
  }
  return toResult(entry.count, entry.resetAt, opts.limit, now);
}

let warned = false;

export async function rateLimit(key: string, opts: Options): Promise<Result> {
  const now = Date.now();
  const resetAt = new Date(now + opts.windowMs);
  // L'heure est passée en paramètre (et non NOW()) : la colonne est un TIMESTAMP sans fuseau,
  // stocké en UTC par Prisma, comme les Date JavaScript envoyées ici.
  const current = new Date(now);
  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${current} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${current} THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    if (!row) return rateLimitInMemory(key, opts);

    // Ménage occasionnel des compteurs expirés (≈ 1 appel sur 100).
    if (Math.random() < 0.01) {
      prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" < ${new Date(now - 3_600_000)}`.catch(() => {});
    }
    return toResult(Number(row.count), new Date(row.resetAt).getTime(), opts.limit, now);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn("[rate-limit] table RateLimitBucket indisponible, compteur en mémoire utilisé :", (error as Error).message);
    }
    return rateLimitInMemory(key, opts);
  }
}

/** Clé IP approximative depuis les headers (Vercel / reverse proxy). */
export function clientIpFromHeaders(headers: Headers): string {
  return (
    // Sur Vercel, x-real-ip est posé par la plateforme (non falsifiable par le client).
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
