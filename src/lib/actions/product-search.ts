"use server";

import { prisma } from "@/lib/prisma";

export interface ProductSearchResult {
  id: string;
  name: string;
  category: string;
  regularPrice: number | null;
  volumes: { label: string; price: number }[] | null;
}

export async function searchProductsForOrder(query: string): Promise<ProductSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.product.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 15,
    select: { id: true, name: true, category: true, regularPrice: true, volumes: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    regularPrice: r.regularPrice,
    volumes: (r.volumes as { label: string; price: number }[] | null) ?? null,
  }));
}
