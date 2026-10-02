import { prisma } from "./prisma";
import type { Category, CategorySlug } from "@/data/types";

import { categories as staticCategories } from "@/data/categories";

export async function getCategories(): Promise<Category[]> {
  try {
    const rows = await prisma.category.findMany({ orderBy: { position: "asc" } });
    if (rows.length === 0) return staticCategories;
    return rows.map((c) => ({
      slug: c.slug as CategorySlug,
      label: c.label,
      navLabel: c.navLabel,
      description: c.description,
      accent: c.accent as Category["accent"],
    }));
  } catch {
    return staticCategories;
  }
}

/** Catégories qui contiennent au moins un produit (pour la vitrine). */
export async function getCategoriesWithProducts(): Promise<Category[]> {
  const all = await getCategories();
  try {
    const counts = await prisma.product.groupBy({ by: ["category"], _count: { _all: true } });
    const filled = new Set(counts.map((c) => c.category));
    return all.filter((c) => filled.has(c.slug));
  } catch {
    return all;
  }
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const c = await prisma.category.findUnique({ where: { slug } });
  if (!c) return undefined;
  return {
    slug: c.slug as CategorySlug,
    label: c.label,
    navLabel: c.navLabel,
    description: c.description,
    accent: c.accent as Category["accent"],
  };
}
