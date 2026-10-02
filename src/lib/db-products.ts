import { prisma } from "./prisma";
import { Product, VolumeOption, CategorySlug } from "@/data/types";
import photoFallback from "@/data/photo-fallback.json";
import type { Product as DbProduct, Prisma } from "@prisma/client";

function toUiProduct(p: DbProduct): Product {
  return {
    id: p.id,
    number: p.number ?? undefined,
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
    // Photo en base, sinon photo associée par nom (voir scripts/map-photos.mjs).
    photo: p.photo ?? (photoFallback as Record<string, string>)[p.slug] ?? undefined,
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
  const row = await prisma.product.findUnique({ where: { slug } });
  return row ? toUiProduct(row) : null;
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
      ...(Number.isFinite(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
    ],
  };
  const rows = await prisma.product.findMany({ where, take: 40 });
  return rows.map(toUiProduct);
}
