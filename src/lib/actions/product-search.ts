"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { searchCatalog } from "@/lib/search-index";

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
  const q = query.trim().slice(0, 80);
  if (!q || !(await auth())?.user) return [];
  // Même moteur que la recherche du site : nom, code, numéro de fiche, catégorie, parfum d'inspiration, fautes de frappe.
  const ranked = await searchCatalog(q, 15).catch(() => null);
  const ids = ranked?.hits.map((h) => h.doc.id) ?? [];
  const rows = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, choganCode: true, number: true, category: true, regularPrice: true, volumes: true } })
    : await prisma.product.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { choganCode: { startsWith: q, mode: "insensitive" } }, ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : [])] },
        take: 15,
        select: { id: true, name: true, choganCode: true, number: true, category: true, regularPrice: true, volumes: true },
      });
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
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
