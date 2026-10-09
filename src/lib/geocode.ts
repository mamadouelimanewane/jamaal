/**
 * Localisation d'une adresse « floue » (« Sacré-Cœur 3 près de la pharmacie ») : recherche
 * tolérante aux fautes (Photon, données OpenStreetMap), puis Nominatim en secours, limitée au
 * Sénégal et orientée vers Dakar. Résultats gardés en cache (table GeocodeCache).
 * Fichier serveur uniquement.
 */
import { prisma } from "./prisma";
import { cleanFuzzyAddress, DAKAR } from "./geo-parse";

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  source: "photon" | "nominatim" | "cache";
}

const UA = "JAMAAL/1.0 (livraisons ; https://jamaal-nine.vercel.app)";
// Sénégal (avec une petite marge)
const BOX = { minLng: -17.7, minLat: 12.2, maxLng: -11.2, maxLat: 16.8 };
const inSenegal = (lat: number, lng: number) => lat >= BOX.minLat && lat <= BOX.maxLat && lng >= BOX.minLng && lng <= BOX.maxLng;

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const r = await fetcher(url, { headers: { "User-Agent": UA, "Accept-Language": "fr" }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> };

async function photon(fetcher: Fetcher, q: string): Promise<GeocodeResult | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=fr&limit=5&lat=${DAKAR.lat}&lon=${DAKAR.lng}&location_bias_scale=0.6&bbox=${BOX.minLng},${BOX.minLat},${BOX.maxLng},${BOX.maxLat}`;
  const data = (await getJson(fetcher, url)) as { features?: PhotonFeature[] } | null;
  for (const f of Array.isArray(data?.features) ? data.features : []) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number" || !inSenegal(lat, lng)) continue;
    const p = f.properties ?? {};
    const label = [p.name, p.district ?? p.locality, p.city ?? p.county].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
    return { lat, lng, label: label || q, source: "photon" };
  }
  return null;
}

async function nominatim(fetcher: Fetcher, q: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=sn&accept-language=fr&viewbox=-17.55,14.9,-17.1,14.6&q=${encodeURIComponent(q)}`;
  const data = (await getJson(fetcher, url)) as { lat?: string; lon?: string; display_name?: string }[] | null;
  for (const r of Array.isArray(data) ? data : []) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!inSenegal(lat, lng)) continue;
    return { lat, lng, label: (r.display_name ?? q).split(",").slice(0, 3).join(",").trim(), source: "nominatim" };
  }
  return null;
}

const key = (q: string) => q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * Cherche la position la plus probable d'une adresse approximative. Essaie l'adresse complète
 * puis ses morceaux (quartier, repère). Retourne null si rien de crédible au Sénégal.
 */
export async function geocodeFuzzy(text: string, fetcher: Fetcher = fetch): Promise<GeocodeResult | null> {
  const queries = cleanFuzzyAddress(text);
  for (const q of queries) {
    const k = key(q);
    const cached = await prisma.geocodeCache.findUnique({ where: { query: k } }).catch(() => null);
    if (cached) {
      if (cached.lat != null && cached.lng != null) return { lat: cached.lat, lng: cached.lng, label: cached.label ?? q, source: "cache" };
      continue; // déjà cherché sans succès
    }
    const withCity = /dakar|thi[eè]s|rufisque|mbour|saint[- ]louis|touba|kaolack|ziguinchor|pikine|gu[ée]diawaye/i.test(q) ? q : `${q}, Dakar`;
    const found = (await photon(fetcher, withCity)) ?? (await photon(fetcher, q)) ?? (await nominatim(fetcher, withCity));
    await prisma.geocodeCache
      .upsert({ where: { query: k }, update: {}, create: { query: k, lat: found?.lat ?? null, lng: found?.lng ?? null, label: found?.label ?? null, source: found?.source ?? null } })
      .catch(() => {});
    if (found) return found;
  }
  return null;
}

/** Suit un lien court (maps.app.goo.gl…) jusqu'à l'adresse longue, sans charger la page. */
export async function expandShortLink(url: string, fetcher: Fetcher = fetch): Promise<string | null> {
  let current = url.trim();
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetcher(current, { redirect: "manual", headers: { "User-Agent": UA } });
      const loc = r.headers.get("location");
      if (!loc) return current;
      current = new URL(loc, current).toString();
    } catch {
      return null;
    }
  }
  return current;
}
