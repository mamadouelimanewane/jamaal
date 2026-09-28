/**
 * Rate limiter simple en mémoire (par instance serveur).
 * Suffisant pour un démarrage ; remplacer par Upstash Redis en multi-instance.
 *
 * Usage :
 *   const limited = rateLimit(`order:${ip}`, { limit: 5, windowMs: 60_000 });
 *   if (!limited.ok) throw new Error("Trop de tentatives, réessayez dans une minute.");
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; remaining: number; retryAfterSec: number } {
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

  const remaining = Math.max(0, opts.limit - entry.count);
  const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

  return {
    ok: entry.count <= opts.limit,
    remaining,
    retryAfterSec,
  };
}

/** Clé IP approximative depuis les headers (Vercel / reverse proxy). */
export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
