/**
 * Itinéraires routiers (tracé sur les routes, distance et durée) avec OSRM (données OpenStreetMap).
 * Serveur public par défaut ; `OSRM_URL` permet d'utiliser votre propre serveur OSRM.
 * Sans réponse (hors ligne, limite atteinte), on revient à une estimation : ligne droite × coefficient ville.
 */
import type { LatLng } from "./delivery";
import { estimateLeg } from "./geo-track";

export type RoadRoute = {
  /** Tracé [lat, lng] à dessiner sur la carte. */
  path: [number, number][];
  km: number;
  minutes: number;
  /** Durée de chaque tronçon (minutes), dans l'ordre des points. */
  legs: { km: number; minutes: number }[];
  source: "osrm" | "estimation";
};

const BASE = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/$/, "");
/** Les livreurs roulent en deux-roues dans les embouteillages : durée OSRM (voiture) ajustée. */
const CITY_FACTOR = 1.25;

/** Lecture de la réponse OSRM (pur, testé). */
export function parseOsrm(json: unknown): Omit<RoadRoute, "source"> | null {
  const j = json as { code?: string; routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] }; legs?: { distance?: number; duration?: number }[] }[] } | null;
  const r = j?.code === "Ok" ? j.routes?.[0] : null;
  const coords = r?.geometry?.coordinates;
  if (!r || !Array.isArray(coords) || coords.length < 2 || typeof r.distance !== "number" || typeof r.duration !== "number") return null;
  const mins = (s: number) => Math.max(1, Math.round((s / 60) * CITY_FACTOR));
  return {
    path: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
    km: Math.round(r.distance / 100) / 10,
    minutes: mins(r.duration),
    legs: (r.legs ?? []).map((l) => ({ km: Math.round((l.distance ?? 0) / 100) / 10, minutes: mins(l.duration ?? 0) })),
  };
}

/** Estimation de repli (ligne droite). */
export function estimatedRoute(points: LatLng[]): RoadRoute {
  const legs = points.slice(1).map((p, i) => estimateLeg(points[i], p));
  return {
    path: points.map((p) => [p.lat, p.lng] as [number, number]),
    km: Math.round(legs.reduce((s, l) => s + l.km, 0) * 10) / 10,
    minutes: legs.reduce((s, l) => s + l.minutes, 0),
    legs,
    source: "estimation",
  };
}

const cache = new Map<string, { at: number; route: RoadRoute }>();
const TTL = 10 * 60_000;
// Arrondi à ~50 m : un livreur qui avance un peu réutilise le même calcul.
const key = (points: LatLng[]) => points.map((p) => `${Math.round(p.lat * 2000)},${Math.round(p.lng * 2000)}`).join(";");

/** Itinéraire passant par les points dans l'ordre (2 à 12 points). */
export async function roadRoute(points: LatLng[], fetcher: typeof fetch = fetch): Promise<RoadRoute> {
  const pts = points.slice(0, 12);
  if (pts.length < 2) return estimatedRoute(pts);
  const k = key(pts);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.route;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  let route: RoadRoute | null = null;
  try {
    const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const res = await fetcher(`${BASE}/route/v1/driving/${coords}?overview=simplified&geometries=geojson&steps=false`, {
      headers: { "User-Agent": "JAMAAL/1.0 (livraisons ; https://www.jamaal.sn)" },
      signal: ctrl.signal,
    });
    const parsed = res.ok ? parseOsrm(await res.json()) : null;
    if (parsed) route = { ...parsed, source: "osrm" };
  } catch {
    // repli ci-dessous
  } finally {
    clearTimeout(timer);
  }
  route ??= estimatedRoute(pts);
  if (route.source === "osrm") {
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(k, { at: Date.now(), route });
  }
  return route;
}
