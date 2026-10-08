"use server";

import { prisma } from "@/lib/prisma";

export interface ProductSearchResult {
  id: string;
  name: string;
  choganCode: string | null;
  number: number | null;
  category: string;
  regularPrice: number | null;
  volumes: { label: string; price: number }[] | null;
}

export async function searchProductsForOrder(query: string): Promise<ProductSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.product.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { choganCode: { startsWith: q, mode: "insensitive" } }, ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : [])] },
    take: 15,
    select: { id: true, name: true, choganCode: true, number: true, category: true, regularPrice: true, volumes: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    choganCode: r.choganCode,
    number: r.number,
    category: r.category,
    regularPrice: r.regularPrice,
    volumes: (r.volumes as { label: string; price: number }[] | null) ?? null,
  }));
}
