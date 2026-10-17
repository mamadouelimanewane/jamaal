/**
 * Listino Chogan (liste de prix des parfums Tribe) : compare la liste officielle au catalogue du site et
 * prépare les formats manquants (30 ml, 15 ml recharge, 50 ml…). Partie pure (testée) : aucune base de données ici.
 *
 * Prix de vente d'un format = prix Chogan en euros × 655,957 (parité fixe) × 1,25, arrondi à la centaine
 * (même règle que db/sql/20261008-02-prix-chogan-plus-25.sql : 35 € → 28 700 FCFA).
 */
import data from "@/data/chogan-listino.json";

export interface ListinoParfum { code: string; code30: string; code15: string; eur: { 15: number; 30: number; 70: number } }
export interface ListinoLuxury { code: string; code15: string; eur: { 15: number; 50: number } }
/** `aliases` : code du listing → code utilisé sur le site quand ils diffèrent (ex. Glory for Him : 068M → 167M). */
export interface ListinoData { edition: string; eurToFcfa: number; markup: number; aliases?: Record<string, string>; parfums: ListinoParfum[]; luxury: ListinoLuxury[] }
export const LISTINO = data as ListinoData;

export interface ListinoFormat { label: string; price: number; publicPrice: number; code: string }

export const REFILL_LABEL = "15 ml · recharge";

export const sellPrice = (eur: number, d: ListinoData = LISTINO) => Math.round((eur * d.eurToFcfa * d.markup) / 100) * 100;
export const publicPrice = (eur: number, d: ListinoData = LISTINO) => Math.round(eur * d.eurToFcfa);

/** Code Chogan comparable : sans espaces, sans zéros de tête, sans lettre finale (001M, 01M, 001 → « 1 »). Les codes-noms (NADIR) sont gardés. */
export function normalizeCode(code: string): string {
  const c = code.toUpperCase().replace(/\s/g, "");
  return /^\d/.test(c) ? c.replace(/[MWUB]$/, "").replace(/^0+(?=\d)/, "") : c;
}

/** « 15 ml · recharge » et « 15 ml » ont la même clé (« 15ml »). */
export function formatKey(label: string): string {
  const m = label.toLowerCase().match(/(\d+)\s*(ml|cl|g)\b/);
  return m ? m[1] + m[2] : label.toLowerCase().trim();
}

const sizeOf = (label: string) => Number(label.match(/\d+/)?.[0] ?? 0);

export type ListinoKind = "parfum" | "luxury";

/** Formats attendus pour une référence du listing, du plus grand au plus petit. */
export function expectedFormats(entry: ListinoParfum | ListinoLuxury, d: ListinoData = LISTINO): ListinoFormat[] {
  const f = (label: string, eur: number, code: string): ListinoFormat => ({ label, price: sellPrice(eur, d), publicPrice: publicPrice(eur, d), code });
  if ("code30" in entry) return [f("70 ml", entry.eur[70], entry.code), f("30 ml", entry.eur[30], entry.code30), f(REFILL_LABEL, entry.eur[15], entry.code15)];
  return [f("50 ml", entry.eur[50], entry.code), f(REFILL_LABEL, entry.eur[15], entry.code15)];
}

export interface PlanProduct {
  id: string;
  name: string;
  category: string;
  choganCode: string | null;
  volumes: unknown;
  variantCount: number;
}

export interface PlanItem {
  productId: string;
  name: string;
  code: string;
  /** Formats à ajouter (ordre d'affichage : du plus grand au plus petit). */
  add: ListinoFormat[];
  /** Le produit n'a pas encore de lignes de stock par format : il faut créer celle du format principal (avec le stock actuel). */
  ensureMain: boolean;
  /** Format principal existant (celui qui porte le stock actuel). */
  mainLabel: string | null;
}

export interface PriceDiff { productId: string; name: string; code: string; format: string; site: number; expected: number }

export interface ListinoPlan {
  items: PlanItem[];
  formatsToAdd: number;
  priceDiffs: PriceDiff[];
  /** Références du listing sans produit correspondant sur le site. */
  notFound: string[];
  /** Produits à format unique (pas de formats définis) : à traiter à la main. */
  singleFormat: { productId: string; name: string; code: string }[];
  complete: number;
  total: number;
}

type Volume = { label?: unknown; price?: unknown };
const volumesOf = (v: unknown): { label: string; price: number }[] =>
  Array.isArray(v) ? (v as Volume[]).filter((x) => typeof x?.label === "string").map((x) => ({ label: String(x.label), price: Number(x.price) || 0 })) : [];

/** Compare le listing au catalogue : formats manquants, écarts de prix, références introuvables. */
export function planListino(products: PlanProduct[], d: ListinoData = LISTINO): ListinoPlan {
  const byCode = new Map<string, PlanProduct>();
  for (const p of products) if (p.choganCode && p.category.startsWith("parfum-")) byCode.set(normalizeCode(p.choganCode), p);

  const plan: ListinoPlan = { items: [], formatsToAdd: 0, priceDiffs: [], notFound: [], singleFormat: [], complete: 0, total: 0 };
  for (const entry of [...d.parfums, ...d.luxury]) {
    plan.total++;
    const product = byCode.get(normalizeCode(entry.code)) ?? (d.aliases?.[entry.code] ? byCode.get(normalizeCode(d.aliases[entry.code])) : undefined);
    if (!product) { plan.notFound.push(entry.code); continue; }
    const have = volumesOf(product.volumes);
    if (!have.length) { plan.singleFormat.push({ productId: product.id, name: product.name, code: entry.code }); continue; }
    const haveKeys = new Map(have.map((v) => [formatKey(v.label), v]));
    const missing: ListinoFormat[] = [];
    for (const f of expectedFormats(entry, d)) {
      const existing = haveKeys.get(formatKey(f.label));
      if (!existing) missing.push(f);
      else if (existing.price > 0 && Math.abs(existing.price - f.price) > 100) plan.priceDiffs.push({ productId: product.id, name: product.name, code: entry.code, format: f.label, site: existing.price, expected: f.price });
    }
    if (!missing.length) { plan.complete++; continue; }
    const main = [...have].sort((a, b) => sizeOf(b.label) - sizeOf(a.label))[0];
    plan.items.push({ productId: product.id, name: product.name, code: entry.code, add: missing, ensureMain: product.variantCount === 0, mainLabel: main?.label ?? null });
    plan.formatsToAdd += missing.length;
  }
  return plan;
}

/** Volumes du produit après ajout des formats : du plus grand au plus petit, sans doublon. */
export function mergeVolumes(existing: unknown, add: ListinoFormat[], mainCode?: string | null): Record<string, unknown>[] {
  const base = (Array.isArray(existing) ? existing : []) as Record<string, unknown>[];
  const seen = new Set(base.map((v) => formatKey(String(v.label ?? ""))));
  const merged = [...base.map((v, i) => (i === 0 && mainCode && v.code == null ? { ...v, code: mainCode } : v))];
  for (const f of add) if (!seen.has(formatKey(f.label))) merged.push({ label: f.label, price: f.price, publicPrice: f.publicPrice, code: f.code });
  return merged.sort((a, b) => sizeOf(String(b.label ?? "")) - sizeOf(String(a.label ?? "")));
}
