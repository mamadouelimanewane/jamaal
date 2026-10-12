import { parseProductDetail, parseSearchResults, type ChoganCard, type ChoganDetail } from "./parse";

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

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; JAMAAL-import/1.0; +https://jamaal-nine.vercel.app)",
  "Accept-Language": "fr-FR,fr;q=0.9",
  Accept: "text/html,application/xhtml+xml",
  Cookie: "language_id=13",
};

async function getHtml(path: string): Promise<string> {
  return throttled(async () => {
    let res: Response;
    try {
      res = await fetch(`${SITE}${path}`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new ChoganError(timeout ? "Le site Chogan ne répond pas (délai dépassé)." : "Le site Chogan est injoignable.");
    }
    if (!res.ok) throw new ChoganError(`Le site Chogan a répondu ${res.status}.`);
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
    const res = await fetch(target, { headers: { "User-Agent": HEADERS["User-Agent"] }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
    if (!res || !res.ok) throw new ChoganError("Photo Chogan indisponible.");
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) throw new ChoganError("Le fichier reçu n'est pas une image.");
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length > 8 * 1024 * 1024) throw new ChoganError("Photo trop lourde.");
    return { data, contentType };
  });
}
