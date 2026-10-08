import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteBaseUrl } from "@/lib/site-url";

// Régénéré au plus toutes les heures.
export const revalidate = 3600;

const STATIC_PAGES = [
  "",
  "/collections",
  "/coffrets-decouverte",
  "/quiz",
  "/blog",
  "/avis-clients",
  "/consultants",
  "/devenir-consultant",
  "/espace-revendeur",
  "/parrainage",
  "/contact",
  "/mentions-legales",
  "/cgv",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const now = new Date();

  let products: { slug: string; updatedAt: Date }[] = [];
  let categories: { slug: string }[] = [];
  let posts: { slug: string; date: Date }[] = [];
  try {
    [products, categories, posts] = await Promise.all([
      prisma.product.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.category.findMany({ select: { slug: true } }),
      prisma.blogPost.findMany({ where: { published: true }, select: { slug: true, date: true } }),
    ]);
  } catch {
    // Base indisponible : on publie au moins les pages fixes.
  }

  return [
    ...STATIC_PAGES.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.6,
    })),
    ...categories.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/produits/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
