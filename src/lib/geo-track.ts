/**
 * Suivi GPS des livraisons : règles pures (testées), utilisables dans le navigateur et sur le serveur.
 */
import { haversineKm, roadKm, etaMinutes, type LatLng } from "./delivery";

/** Le livreur est « à l'arrivée » à moins de cette distance (m) : message au client. */
export const ARRIVING_M = 400;
/** Livraison confirmée à plus de cette distance (m) de l'adresse : signalée à l'équipe. */
export const DELIVERY_FAR_M = 500;
/** Position considérée comme « en direct » pendant (minutes). */
export const FRESH_MIN = 10;
/** Durée de conservation de la trace GPS (jours). */
export const PING_RETENTION_DAYS = 30;

export const distanceM = (a: LatLng, b: LatLng) => Math.round(haversineKm(a, b) * 1000);

export type Fix = LatLng & { at: number };

/**
 * Envoi d'une nouvelle position : jamais plus d'une fois toutes les 5 s ; dès qu'on a bougé de 20 m
 * (après 8 s) ; sinon une fois toutes les 45 s pour signaler qu'on est toujours là.
 */
export function shouldSend(last: Fix | null, next: Fix): boolean {
  if (!last) return true;
  const dt = next.at - last.at;
  if (dt < 5_000) return false;
  if (dt >= 45_000) return true;
  return dt >= 8_000 && distanceM(last, next) >= 20;
}

/** Position récente (moins de `maxMin` minutes). */
export function isFresh(lastSeenAt: Date | string | null | undefined, now = new Date(), maxMin = FRESH_MIN): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  return Number.isFinite(t) && now.getTime() - t <= maxMin * 60_000;
}

/** Trace allégée : on garde un point tous les `minM` mètres, au plus `max` points (les plus récents). */
export function simplifyTrail(points: LatLng[], minM = 15, max = 400): LatLng[] {
  const kept: LatLng[] = [];
  for (const p of points) {
    const prev = kept[kept.length - 1];
    if (!prev || distanceM(prev, p) >= minM) kept.push({ lat: p.lat, lng: p.lng });
  }
  const last = points[points.length - 1];
  if (last && kept.length && kept[kept.length - 1] !== last && distanceM(kept[kept.length - 1], last) > 0) kept.push({ lat: last.lat, lng: last.lng });
  return kept.length > max ? kept.slice(kept.length - max) : kept;
}

/** Ordre de passage conseillé : à chaque fois l'arrêt le plus proche (plus proche voisin). */
export function orderStops<T extends LatLng>(start: LatLng, stops: T[]): T[] {
  const left = [...stops];
  const out: T[] = [];
  let here = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (haversineKm(here, left[i]) < haversineKm(here, left[best])) best = i;
    const [s] = left.splice(best, 1);
    out.push(s);
    here = s;
  }
  return out;
}

/** Estimation sans service d'itinéraire : distance routière et durée moyennes en ville. */
export function estimateLeg(a: LatLng, b: LatLng): { km: number; minutes: number } {
  const km = roadKm(a, b);
  return { km, minutes: etaMinutes(km) };
}

/** « il y a 12 s », « il y a 4 min », « il y a 2 h ». */
export function ago(date: Date | string | null | undefined, now = new Date()): string {
  if (!date) return "jamais";
  const s = Math.max(0, Math.round((now.getTime() - new Date(date).getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86_400)} j`;
}

/** Contrôle d'une position reçue du téléphone. */
export function parseFix(body: unknown): (LatLng & { accuracy: number | null; speed: number | null; heading: number | null }) | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const lat = num(b.lat);
  const lng = num(b.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const accuracy = num(b.accuracy);
  const speed = num(b.speed);
  const heading = num(b.heading);
  return {
    lat,
    lng,
    accuracy: accuracy !== null && accuracy >= 0 ? Math.min(accuracy, 100_000) : null,
    speed: speed !== null && speed >= 0 && speed < 70 ? speed : null,
    heading: heading !== null && heading >= 0 && heading <= 360 ? heading : null,
  };
}
