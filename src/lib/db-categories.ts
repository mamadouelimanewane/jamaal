import { prisma } from "./prisma";
import type { Category, CategorySlug } from "@/data/types";

import { categories as staticCategories } from "@/data/categories";
import { getLocale } from "@/lib/i18n/server";
import { translator } from "@/lib/i18n/translate";

/** Libellés des gammes dans la langue de la page (dictionnaire italien ; sinon français). */
async function localize(list: Category[]): Promise<Category[]> {
  const locale = await getLocale();
  if (locale === "fr") return list;
  const t = translator(locale);
  return list.map((c) => ({ ...c, label: t(c.label), navLabel: t(c.navLabel), description: t(c.description) }));
}

export async function getCategories(): Promise<Category[]> {
  return localize(await rawCategories());
}

async function rawCategories(): Promise<Category[]> {
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
  const [one] = await localize([
    {
      slug: c.slug as CategorySlug,
      label: c.label,
      navLabel: c.navLabel,
      description: c.description,
      accent: c.accent as Category["accent"],
    },
  ]);
  return one;
}
