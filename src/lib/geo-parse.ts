/**
 * Lecture d'une position collée par le client ou le vendeur : coordonnées, lien Google Maps /
 * WhatsApp / Apple Plans / OpenStreetMap, ou Plus Code (« QF2V+8M Dakar »).
 * Pur (sans réseau) : utilisable côté navigateur et côté serveur.
 */

export interface ParsedPoint {
  lat: number;
  lng: number;
  /** D'où vient la position (pour l'affichage). */
  source: "coordonnees" | "lien" | "plus-code";
}

/** Point de référence pour les Plus Codes courts (« QF2V+8M ») : Dakar. */
export const DAKAR = { lat: 14.6928, lng: -17.4467 };

function valid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function pair(a: string, b: string): { lat: number; lng: number } | null {
  const lat = Number(a);
  const lng = Number(b);
  return valid(lat, lng) ? { lat, lng } : null;
}

const NUM = String.raw`[-+]?\d{1,3}(?:[.,]\d+)?`;

/** Coordonnées écrites : « 14.7167, -17.4677 », « 14,7167 -17,4677 », « 14°43'N 17°28'W ». */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  // Degrés minutes secondes
  const dms = t.match(/(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:[.,]\d+)?)?["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:[.,]\d+)?)?["″]?\s*([EOW])/i);
  if (dms) {
    const conv = (d: string, m: string, s: string | undefined, h: string) => {
      const v = Number(d) + Number(m) / 60 + Number((s ?? "0").replace(",", ".")) / 3600;
      return /[SWO]/i.test(h) ? -v : v;
    };
    const lat = conv(dms[1], dms[2], dms[3], dms[4]);
    const lng = conv(dms[5], dms[6], dms[7], dms[8]);
    return valid(lat, lng) ? { lat, lng } : null;
  }
  // Décimal (virgule décimale acceptée quand le séparateur est un espace ou un point-virgule)
  const dec = t.match(new RegExp(String.raw`^\(?\s*(${NUM})\s*[,;\s]\s*(${NUM})\s*\)?$`));
  if (dec) return pair(dec[1].replace(",", "."), dec[2].replace(",", "."));
  const dot = t.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (dot) return pair(dot[1], dot[2]);
  return null;
}

/** Liens de cartes : Google Maps (toutes formes), WhatsApp (lien Google), Apple Plans, OSM, geo:. */
export function parseMapLink(text: string): { lat: number; lng: number } | null {
  let t = text.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    // lien mal encodé : on lit tel quel
  }
  const patterns: RegExp[] = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // Google : coordonnées exactes du lieu
    /[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // Google : centre de la carte
    /geo:(-?\d+\.\d+),(-?\d+\.\d+)/i,
    /\/maps\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/i,
    /\/dir\/[^/]*\/(-?\d+\.\d+),(-?\d+\.\d+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const p = pair(m[1], m[2]);
      if (p) return p;
    }
  }
  const mlat = t.match(/[?&#]mlat=(-?\d+\.\d+)/i);
  const mlon = t.match(/[?&#]mlon=(-?\d+\.\d+)/i);
  if (mlat && mlon) return pair(mlat[1], mlon[1]);
  const osm = t.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
  if (osm) return pair(osm[1], osm[2]);
  return null;
}

/** Lien court à résoudre côté serveur (maps.app.goo.gl, goo.gl/maps…). */
export function isShortMapLink(text: string) {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.google\.[a-z.]+\/\?cid)/i.test(text.trim());
}

// ---------- Plus Codes (Open Location Code) ----------
const OLC = "23456789CFGHJMPQRVWX";
const PAIR_RES = [20.0, 1.0, 0.05, 0.0025, 0.000125];

function decodeFull(code: string): { lat: number; lng: number; size: number } | null {
  const c = code.toUpperCase().replace("+", "").replace(/0+$/, "");
  if (c.length < 8 || [...c].some((ch) => !OLC.includes(ch))) return null;
  let lat = -90;
  let lng = -180;
  let size = 20;
  for (let i = 0; i < Math.min(c.length, 10); i += 2) {
    size = PAIR_RES[i / 2];
    lat += OLC.indexOf(c[i]) * size;
    lng += OLC.indexOf(c[i + 1] ?? "2") * size;
  }
  let latSize = size;
  let lngSize = size;
  for (let i = 10; i < c.length; i++) {
    latSize /= 5;
    lngSize /= 4;
    const d = OLC.indexOf(c[i]);
    lat += Math.floor(d / 4) * latSize;
    lng += (d % 4) * lngSize;
  }
  return { lat: lat + latSize / 2, lng: lng + lngSize / 2, size: latSize };
}

/** Plus Code complet (« 7FB8QF2V+8M ») ou court (« QF2V+8M », relatif à Dakar ou au point donné). */
export function parsePlusCode(text: string, ref = DAKAR): { lat: number; lng: number } | null {
  const m = text.toUpperCase().match(/\b([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3})\b/);
  if (!m) return null;
  const code = m[1];
  const sep = code.indexOf("+");
  if (sep === 8) {
    const d = decodeFull(code);
    return d && valid(d.lat, d.lng) ? { lat: d.lat, lng: d.lng } : null;
  }
  // Code court : on complète avec le préfixe de la zone de référence puis on choisit la cellule la plus proche.
  const padding = 8 - sep;
  const resolution = Math.pow(20, 2 - padding / 2);
  const refCode = encodePrefix(ref.lat, ref.lng);
  const d = decodeFull(refCode.slice(0, padding) + code);
  if (!d) return null;
  let { lat, lng } = d;
  const half = resolution / 2;
  if (ref.lat + half < lat && lat - resolution >= -90) lat -= resolution;
  else if (ref.lat - half > lat && lat + resolution <= 90) lat += resolution;
  if (ref.lng + half < lng) lng -= resolution;
  else if (ref.lng - half > lng) lng += resolution;
  return valid(lat, lng) ? { lat, lng } : null;
}

function encodePrefix(lat: number, lng: number) {
  let la = lat + 90;
  let ln = lng + 180;
  let out = "";
  for (let i = 0; i < 4; i++) {
    const res = PAIR_RES[i];
    const a = Math.floor(la / res);
    const b = Math.floor(ln / res);
    out += OLC[a] + OLC[b];
    la -= a * res;
    ln -= b * res;
  }
  return out;
}

/** Essaie tous les formats précis (sans réseau). */
export function parseLocation(text: string): ParsedPoint | null {
  const t = text.trim();
  if (!t) return null;
  const c = parseCoordinates(t);
  if (c) return { ...c, source: "coordonnees" };
  const l = parseMapLink(t);
  if (l) return { ...l, source: "lien" };
  const p = parsePlusCode(t);
  if (p) return { ...p, source: "plus-code" };
  return null;
}

/**
 * Nettoie une adresse « floue » pour la recherche : retire les repères relatifs (près de, en face,
 * derrière…), les numéros de villa ou d'appartement, et garde les noms de lieux.
 */
export function cleanFuzzyAddress(text: string): string[] {
  const base = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\n\r]+/g, ", ")
    .replace(/(?<![\p{L}\d])(villa|vla|appartement|appt|app|apt|porte|immeuble|imm|lot|n°|no|num[ée]ro|[ée]tage|maison)(?![\p{L}])\s*(?:n°\s*)?[\p{L}\d-]*\d[\p{L}\d-]*|(?<![\p{L}\d])(villa|appartement|immeuble|maison|[ée]tage)(?![\p{L}])/giu, " ")
    .replace(/(?<![\p{L}\d])(pr[eè]s (?:de|du|des|d')|[àa] c[oô]t[ée](?: (?:de|du|des|d'))?|en face(?: (?:de|du|des|d'))?|derri[eè]re|devant|juste apr[eè]s|apr[eè]s|avant|vers|non loin(?: (?:de|du|des|d'))?|chez)(?![\p{L}\d])/giu, ",")
    .replace(/\s+/g, " ")
    .trim();
  const parts = base.split(/[,;/]+/).map((s) => s.trim()).filter((s) => s.length >= 3);
  const queries = new Set<string>();
  if (parts.length) queries.add(parts.join(", "));
  for (const p of parts) queries.add(p);
  return [...queries].slice(0, 5);
}
