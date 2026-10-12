import { parseProductDetail, parseSearchResults, type ChoganCard, type ChoganDetail } from "./parse";
import { RELAY_HEADER, RELAY_PATH, relaySecret, relayToken } from "./relay";

/**
 * Accès réseau au site Chogan, côté serveur uniquement (importé seulement par les actions serveur). Une requête à la fois par instance, au
 * moins 400 ms entre deux, 10 s au plus chacune ; la langue française est demandée explicitement
 * (cookie language_id=13 du site Chogan). CHOGAN_BASE_URL / CHOGAN_CDN_BASE permettent de viser un
 * faux site en test local.
 */
const SITE = (process.env.CHOGAN_BASE_URL || "https://www.chogangroupspa.com").replace(/\/$/, "");
const CDN_HOST = "cdn.chogangroupspa.com";
const MIN_GAP_MS = 400;
const TIMEOUT_MS = 10_000;

export class ChoganError extends Error {}

let queue: Promise<unknown> = Promise.resolve();
let lastAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastAt = Date.now();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Ancien jeu d'en-têtes (robot déclaré) : refusé (403) par le site Chogan depuis les serveurs. */
export const LEGACY_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (compatible; JAMAAL-import/1.0; +https://jamaal-nine.vercel.app)",
  "Accept-Language": "fr-FR,fr;q=0.9",
  Accept: "text/html,application/xhtml+xml",
  Cookie: "language_id=13",
};

/** En-têtes d'un navigateur ordinaire : le site Chogan filtre les visiteurs qui se déclarent robots. */
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,it;q=0.7",
  "Cache-Control": "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  Cookie: "language_id=13",
};
const HEADERS = BROWSER_HEADERS;

/**
 * Requête vers Chogan. En ligne (Vercel), Cloudflare bloque les fonctions serveur : on passe par
 * le relais edge du site (même domaine). En local ou en test (CHOGAN_BASE_URL), accès direct.
 */
async function choganFetch(url: string, init: { headers: Record<string, string> }): Promise<Response> {
  const secret = relaySecret();
  if (process.env.VERCEL && secret && !process.env.CHOGAN_BASE_URL) {
    const { getSiteUrl } = await import("@/lib/site-url");
    const origin = (await getSiteUrl()) || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
    return fetch(`${origin}${RELAY_PATH}?u=${encodeURIComponent(url)}`, {
      headers: { [RELAY_HEADER]: await relayToken(secret) },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS + 3_000),
    });
  }
  return fetch(url, { headers: init.headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function getHtml(path: string): Promise<string> {
  return throttled(async () => {
    let res: Response;
    try {
      res = await choganFetch(`${SITE}${path}`, { headers: HEADERS });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new ChoganError(timeout ? "Le site Chogan ne répond pas (délai dépassé)." : "Le site Chogan est injoignable.");
    }
    if (!res.ok) {
      const region = res.headers.get("x-relay-region");
      throw new ChoganError(res.status === 401 ? "Relais Chogan : accès refusé (secret différent)." : `Le site Chogan a répondu ${res.status}${region ? ` (relais ${region})` : ""}.`);
    }
    return res.text();
  });
}

export async function fetchChoganDetail(number: number): Promise<ChoganDetail | null> {
  if (!Number.isInteger(number) || number <= 0) return null;
  const html = await getHtml(`/chogangroup/productDetail/${number}`);
  const detail = parseProductDetail(html);
  if (!detail && /id="id_art"/.test(html)) throw new ChoganError("Format de fiche Chogan non reconnu : la page a peut-être changé.");
  return detail;
}

export async function searchChogan(text: string): Promise<ChoganCard[]> {
  const q = text.trim().slice(0, 80);
  if (!q) return [];
  return parseSearchResults(await getHtml(`/chogangroup/productList?search=${encodeURIComponent(q)}`));
}

/** Seules les images du serveur d'images Chogan sont téléchargées (pas d'adresse arbitraire). */
export function isChoganImage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === CDN_HOST && u.pathname.startsWith("/images/prodotti/");
  } catch {
    return false;
  }
}

export async function fetchChoganImage(url: string): Promise<{ data: Uint8Array; contentType: string }> {
  if (!isChoganImage(url)) throw new ChoganError("Adresse d'image refusée.");
  const target = process.env.CHOGAN_CDN_BASE ? url.replace(`https://${CDN_HOST}`, process.env.CHOGAN_CDN_BASE.replace(/\/$/, "")) : url;
  return throttled(async () => {
    const res = await choganFetch(target, { headers: { "User-Agent": HEADERS["User-Agent"] } }).catch(() => null);
    if (!res || !res.ok) throw new ChoganError("Photo Chogan indisponible.");
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) throw new ChoganError("Le fichier reçu n'est pas une image.");
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length > 8 * 1024 * 1024) throw new ChoganError("Photo trop lourde.");
    return { data, contentType };
  });
}
