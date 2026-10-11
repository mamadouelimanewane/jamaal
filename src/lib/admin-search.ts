/**
 * Recherche du back-office (pages Produits et Stocks) : même moteur que la boutique, donc
 * insensible aux accents, aux fautes de frappe et à l'ordre des mots ; trouve aussi les produits
 * par parfum d'inspiration (« Sauvage »), marque (« Dior »), code Chogan d'un format (301M, T001M)
 * ou numéro de fiche, et classe les résultats par pertinence.
 */
import { prisma } from "./prisma";
import { normalize } from "./search-engine";
import { searchCatalog } from "./search-index";
import type { StockRow } from "./inventory-report";

export interface ProductRanking {
  /** Identifiants des produits trouvés, du plus pertinent au moins pertinent. */
  ids: string[];
  /** Requête corrigée (« Vouliez-vous dire ») quand l'orthographe a été rectifiée. */
  corrected: string | null;
}

/** Produits correspondant à la recherche, classés par pertinence (sans appel à l'IA). */
export async function rankProducts(query: string): Promise<ProductRanking> {
  const code = query.trim();
  const [r, variants] = await Promise.all([
    searchCatalog(query, 100_000),
    // Code d'un format saisi tel quel (les codes hors du schéma 001M / 301M / T001M compris).
    code.length >= 3 && code.length <= 40 && !/\s/.test(code)
      ? prisma.productVariant.findMany({ where: { code: { equals: code, mode: "insensitive" } }, select: { productId: true } })
      : Promise.resolve([]),
  ]);
  const ids = [...new Set([...variants.map((v) => v.productId), ...r.hits.map((h) => h.doc.id)])];
  return { ids, corrected: variants.length ? null : r.corrected };
}

const compact = (s: string) => normalize(s).replace(/ /g, "");

/**
 * Lignes de stock (une par format) correspondant à la recherche, dans l'ordre de pertinence des
 * produits. Un code de format saisi tel quel (301M) ou un volume (« 30 ml ») ne garde que les
 * formats concernés.
 */
export function filterStockRows(rows: StockRow[], query: string, ranking: ProductRanking): StockRow[] {
  const whole = compact(query);
  // Code exact d'un format : uniquement cette ligne.
  if (whole.length >= 3) {
    const byCode = rows.filter((r) => r.code && compact(r.code) === whole);
    if (byCode.length) return byCode;
  }

  const rank = new Map(ranking.ids.map((id, i) => [id, i]));
  let out = rows.filter((r) => rank.has(r.productId));

  // Volume demandé (« 30 ml », « 15ml ») : on garde ces formats s'il y en a.
  const ml = normalize(query).match(/(\d{1,4}) ?ml\b/)?.[1];
  if (ml) {
    const sized = out.filter((r) => new RegExp(`(^|\\D)${ml} ?ml`, "i").test(r.format));
    if (sized.length) out = sized;
  }

  return out.sort((a, b) => rank.get(a.productId)! - rank.get(b.productId)! || a.format.localeCompare(b.format, "fr", { numeric: true }));
}

/** Résumé du stock d'un produit à partir de ses formats. */
export interface ProductStock {
  total: number;
  formats: number;
  rupture: number;
  bas: number;
  status: "rupture" | "bas" | "ok";
}

export function productStockSummary(rows: StockRow[]): Map<string, ProductStock> {
  const map = new Map<string, ProductStock>();
  for (const r of rows) {
    const s = map.get(r.productId) ?? { total: 0, formats: 0, rupture: 0, bas: 0, status: "ok" as const };
    s.total += r.stock;
    s.formats += 1;
    if (r.status === "rupture") s.rupture += 1;
    if (r.status === "bas") s.bas += 1;
    s.status = s.rupture ? (s.rupture === s.formats ? "rupture" : "bas") : s.bas ? "bas" : "ok";
    map.set(r.productId, s);
  }
  return map;
}
