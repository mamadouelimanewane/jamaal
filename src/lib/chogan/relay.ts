/**
 * Relais vers le site Chogan. Cloudflare (devant chogangroupspa.com) bloque les fonctions serveur
 * de Vercel (403 « Attention Required ») mais laisse passer le réseau edge de Vercel : le serveur
 * passe donc par la route edge /api/chogan-relay, protégée par un jeton dérivé du secret de
 * connexion (AUTH_SECRET), et limitée aux pages produit, à la recherche et aux images Chogan.
 * Compatible edge et Node (crypto.subtle).
 */
export const RELAY_PATH = "/api/chogan-relay";
export const RELAY_HEADER = "x-jamaal-relay";

const SITE_HOST = "www.chogangroupspa.com";
const CDN_HOST = "cdn.chogangroupspa.com";

export function relaySecret(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export async function relayToken(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:chogan-relay:v1`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Adresse Chogan autorisée (pages produit, recherche, images), sinon null. */
export function allowedChoganUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  if (u.hostname === SITE_HOST && /^\/chogangroup\/(productDetail\/\d+|productList)$/.test(u.pathname)) return u;
  if (u.hostname === CDN_HOST && u.pathname.startsWith("/images/prodotti/") && !u.pathname.includes("..")) return u;
  return null;
}
