/**
 * Tableau des stocks : une ligne par format (ou par produit sans format), avec la valeur,
 * les ventes des 30 derniers jours, la couverture et la quantité à commander.
 */
import { prisma } from "./prisma";
import { getBusinessModel } from "./business-model-store";
import { getCategories } from "./db-categories";

export type StockStatus = "rupture" | "bas" | "ok";

export interface StockRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  code: string | null;
  format: string;
  stock: number;
  threshold: number;
  salePrice: number | null;
  unitCost: number | null;
  sold30: number;
  coverageDays: number | null;
  toOrder: number;
  status: StockStatus;
}

type Volume = { label?: string; price?: number; publicPrice?: number; code?: string };

/** Quantité conseillée : de quoi tenir 30 jours au rythme des ventes, au moins 2 × le seuil. */
export function suggestOrder(stock: number, threshold: number, sold30: number) {
  const target = Math.max(threshold * 2, Math.ceil(sold30));
  const coverageLow = sold30 > 0 && stock / (sold30 / 30) < 15;
  if (stock > threshold && !coverageLow) return 0;
  return Math.max(0, target - stock);
}

export function stockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return "rupture";
  if (stock <= threshold) return "bas";
  return "ok";
}

export async function getStockRows(): Promise<StockRow[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [products, sales, model, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, slug: true, category: true, choganCode: true, stock: true, lowStockThreshold: true,
        regularPrice: true, publicPrice: true, volumes: true,
        variants: { select: { id: true, volumeLabel: true, code: true, stock: true, lowStockThreshold: true }, orderBy: { id: "asc" } },
      },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId", "variantId"],
      where: { createdAt: { gte: since }, kind: { in: ["VENTE", "ANNULATION"] } },
      _sum: { delta: true },
    }),
    getBusinessModel(),
    getCategories(),
  ]);
  const labels = new Map(categories.map((c) => [c.slug as string, c.navLabel.replace("JAMAAL ", "")]));
  const soldBy = new Map(sales.map((s) => [`${s.productId}:${s.variantId ?? ""}`, Math.max(0, -(s._sum.delta ?? 0))]));
  const cost = (publicPrice: number | null | undefined) => (publicPrice ? Math.round((publicPrice * model.purchasePct) / 100) : null);

  const rows: StockRow[] = [];
  for (const p of products) {
    const volumes = (Array.isArray(p.volumes) ? p.volumes : []) as Volume[];
    const base = { productId: p.id, name: p.name, slug: p.slug, category: p.category, categoryLabel: labels.get(p.category) ?? p.category };
    const push = (variantId: string | null, format: string, code: string | null, stock: number, threshold: number, salePrice: number | null, unitCost: number | null) => {
      const sold30 = soldBy.get(`${p.id}:${variantId ?? ""}`) ?? 0;
      rows.push({
        ...base,
        key: variantId ?? p.id,
        variantId,
        format,
        code,
        stock,
        threshold,
        salePrice,
        unitCost,
        sold30,
        coverageDays: sold30 > 0 ? Math.floor(stock / (sold30 / 30)) : null,
        toOrder: suggestOrder(stock, threshold, sold30),
        status: stockStatus(stock, threshold),
      });
    };
    if (p.variants.length) {
      for (const v of p.variants) {
        const vol = volumes.find((x) => x.label === v.volumeLabel);
        push(v.id, v.volumeLabel, v.code ?? vol?.code ?? null, v.stock, v.lowStockThreshold, vol?.price ?? null, cost(vol?.publicPrice ?? (v.code === p.choganCode ? p.publicPrice : null)));
      }
    } else {
      push(null, "Format unique", p.choganCode, p.stock, p.lowStockThreshold, p.regularPrice, cost(p.publicPrice));
    }
  }
  return rows;
}

export function stockTotals(rows: StockRow[]) {
  return {
    formats: rows.length,
    products: new Set(rows.map((r) => r.productId)).size,
    units: rows.reduce((s, r) => s + Math.max(0, r.stock), 0),
    costValue: rows.reduce((s, r) => s + Math.max(0, r.stock) * (r.unitCost ?? 0), 0),
    saleValue: rows.reduce((s, r) => s + Math.max(0, r.stock) * (r.salePrice ?? 0), 0),
    outOfStock: rows.filter((r) => r.status === "rupture").length,
    low: rows.filter((r) => r.status === "bas").length,
    toOrder: rows.filter((r) => r.toOrder > 0).length,
  };
}

/**
 * Trouve un article par code saisi : code de format (301M, T001M), code Chogan du produit,
 * ou numéro de fiche. Retourne null si introuvable ou ambigu.
 */
export async function findByCode(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const variants = await prisma.productVariant.findMany({ where: { code: { equals: code, mode: "insensitive" } }, select: { id: true, productId: true, volumeLabel: true, product: { select: { name: true } } } });
  if (variants.length === 1) return { productId: variants[0].productId, variantId: variants[0].id, label: variants[0].volumeLabel, name: variants[0].product.name };
  const products = await prisma.product.findMany({
    where: { OR: [{ choganCode: { equals: code, mode: "insensitive" } }, ...(/^\d+$/.test(code) ? [{ number: Number(code) }] : [])] },
    select: { id: true, name: true, choganCode: true, variants: { select: { id: true, volumeLabel: true, code: true }, orderBy: { id: "asc" } } },
  });
  if (products.length !== 1) return null;
  const p = products[0];
  if (!p.variants.length) return { productId: p.id, variantId: null, label: "Format unique", name: p.name };
  const main = p.variants.find((v) => v.code && v.code === p.choganCode) ?? p.variants[0];
  return { productId: p.id, variantId: main.id, label: main.volumeLabel, name: p.name };
}
