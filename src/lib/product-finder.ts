/**
 * Recherche de produits côté revendeur (Mon marketing, kit marketing, visuels). Pur, testé.
 * Trouve un produit par son nom, son code Chogan (001M, T001M…), sa catégorie (« parfum femme »), le parfum de marque dont il s'inspire
 * (« Sauvage », « Acqua di Gio ») ou cette marque (« Dior »), sans tenir compte des accents ni des majuscules.
 * Les meilleurs résultats d'abord : code exact, puis nom qui commence par la recherche, puis le reste.
 */
export interface FindableProduct {
  name: string;
  choganCode?: string | null;
  inspiredBy?: string | null;
  inspiredBrand?: string | null;
  shortDescription?: string | null;
  /** Catégorie (« Parfums homme »…) et famille olfactive : on trouve aussi « parfum », « femme », « boisé ». */
  categoryLabel?: string | null;
  family?: string | null;
}

import { editDistance } from "./search-engine";

export const normText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const compact = (s: string) => s.replace(/[^a-z0-9]/g, "");
/** Code Chogan comparable : sans séparateur ni zéros de tête (« 021M » = « 21m » = « 21 M »). */
const codeKey = (s: string) => compact(s).replace(/^([a-z]*)0+(?=\d)/, "$1");

/** Mot trouvé : tel quel, au singulier, ou avec une faute de frappe (1 lettre dès 4 lettres, 2 dès 8). */
function wordHit(w: string, hay: string, tokens: string[]): boolean {
  if (hay.includes(w)) return true;
  if (w.length > 3 && w.endsWith("s") && hay.includes(w.slice(0, -1))) return true;
  const max = w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
  return max > 0 && tokens.some((t) => Math.abs(t.length - w.length) <= max && editDistance(t, w, max) <= max);
}

function score(p: FindableProduct, q: string): number {
  const code = normText(p.choganCode ?? "");
  const name = normText(p.name);
  const words = q.split(" ");
  const hay = normText([p.name, p.choganCode, p.inspiredBy, p.inspiredBrand, p.categoryLabel, p.family, p.shortDescription].filter(Boolean).join(" "));
  if (code && (code === q || codeKey(code) === codeKey(q))) return 100;
  const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
  // « aquasoul » = « Aqua Soul » : on compare aussi sans les espaces.
  const glued = compact(q).length >= 5 && (compact(name).includes(compact(q)) || compact(normText(p.inspiredBy ?? "")).includes(compact(q)));
  if (!glued && !words.every((w) => wordHit(w, hay, tokens))) return 0;
  if (name.startsWith(q)) return 80;
  if (name.includes(q) || glued) return 60;
  if (normText(p.inspiredBy ?? "").includes(q)) return 50;
  return words.every((w) => hay.includes(w)) ? 20 : 10;
}

/** Produits correspondant à la recherche (2 caractères au moins), triés par pertinence. */
export function findProducts<T extends FindableProduct>(products: T[], query: string, limit = 8): T[] {
  const q = normText(query);
  if (q.length < 2) return [];
  return products
    .map((p, i) => ({ p, i, s: score(p, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** « inspiré de Sauvage (Dior) », ou "" : aide le revendeur à reconnaître le bon parfum. */
export function inspirationLabel(p: Pick<FindableProduct, "inspiredBy" | "inspiredBrand">): string {
  if (!p.inspiredBy) return "";
  return `inspiré de ${p.inspiredBy}${p.inspiredBrand ? ` (${p.inspiredBrand})` : ""}`;
}
