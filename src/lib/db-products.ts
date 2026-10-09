import { prisma } from "./prisma";
import { Product, VolumeOption, CategorySlug } from "@/data/types";
import type { Product as DbProduct, Prisma } from "@prisma/client";

function toUiProduct(p: DbProduct): Product {
  return {
    id: p.id,
    number: p.number ?? undefined,
    choganCode: p.choganCode ?? undefined,
    inspiredBy: p.inspiredBy ?? undefined,
    inspiredBrand: p.inspiredBrand ?? undefined,
    slug: p.slug,
    name: p.name,
    category: p.category as CategorySlug,
    family: p.family ?? undefined,
    topNotes: p.topNotes.length ? p.topNotes : undefined,
    heartNotes: p.heartNotes.length ? p.heartNotes : undefined,
    baseNotes: p.baseNotes.length ? p.baseNotes : undefined,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    testerPrice: p.testerPrice ?? undefined,
    volumes: (p.volumes as unknown as VolumeOption[] | null) ?? undefined,
    regularPrice: p.regularPrice ?? undefined,
    reviewCount: p.reviewCount,
    rating: p.rating,
    badge: (p.badge as Product["badge"]) ?? undefined,
    colorFrom: p.colorFrom,
    colorTo: p.colorTo,
    photo: p.photo ?? undefined,
    isOfficial: p.isOfficial,
  };
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { category },
    orderBy: { reviewCount: "desc" },
  });
  return rows.map(toUiProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({ where: { slug }, include: { variants: { select: { volumeLabel: true, stock: true } } } });
  if (!row) return null;
  const product = toUiProduct(row);
  // Disponibilité par format : stock du format s'il existe, sinon stock du produit.
  const labels = product.volumes?.length ? product.volumes.map((v) => v.label) : ["Format unique"];
  product.availability = Object.fromEntries(
    labels.map((label) => [label, row.variants.length ? Math.max(0, row.variants.find((v) => v.volumeLabel === label)?.stock ?? 0) : Math.max(0, row.stock)])
  );
  return product;
}

/** Coffrets, kits et sets du catalogue Chogan (pour la page Coffrets). */
export async function getGiftSets(): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      OR: ["coffret", "kit ", "set ", " set", "combo", "box", "bundle"].map((w) => ({ name: { contains: w, mode: "insensitive" as const } })),
    },
    orderBy: { name: "asc" },
    take: 60,
  });
  return rows.map(toUiProduct);
}

export async function getBestsellers(category?: string, count = 3): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: category ? { category } : undefined,
    orderBy: { reviewCount: "desc" },
    take: count,
  });
  return rows.map(toUiProduct);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];
  const asNumber = Number(q.replace(/\D/g, ""));
  const where: Prisma.ProductWhereInput = {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { inspiredBy: { contains: q, mode: "insensitive" } },
      { inspiredBrand: { contains: q, mode: "insensitive" } },
      { choganCode: { startsWith: q.replace(/^cod\.?\s*/i, "").replace(/^n°\s*/i, ""), mode: "insensitive" } },
      ...(Number.isFinite(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
    ],
  };
  const rows = await prisma.product.findMany({ where, take: 40 });
  return rows.map(toUiProduct);
}

/** Produits dans l'ordre des identifiants donnés (résultats de recherche). */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, toUiProduct(r)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
}
