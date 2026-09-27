import { prisma } from "./prisma";
import type { Category, CategorySlug } from "@/data/types";

export async function getCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ orderBy: { position: "asc" } });
  return rows.map((c) => ({
    slug: c.slug as CategorySlug,
    label: c.label,
    navLabel: c.navLabel,
    description: c.description,
    accent: c.accent as Category["accent"],
  }));
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
