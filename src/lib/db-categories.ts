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
