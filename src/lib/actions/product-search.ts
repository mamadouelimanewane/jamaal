"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { searchCatalog } from "@/lib/search-index";
import { isUnsoldFormat, sellableVolumes } from "@/lib/price-from";

export interface ProductSearchResult {
  id: string;
  name: string;
  choganCode: string | null;
  number: number | null;
  category: string;
  regularPrice: number | null;
  volumes: { label: string; price: number }[] | null;
  /** Formats en vente avec leur code et leur stock (liste de prix + formats suivis en stock). */
  formats: { label: string; price: number; code: string | null; stock: number | null }[];
  photo: string | null;
}

type Fmt = ProductSearchResult["formats"][number];
const keyOf = (s: string) => s.toLowerCase().replace(/[^0-9a-z]/g, "");

/** Formats d'un produit : liste de prix (70 ml, 30 ml…) complétée par les formats suivis en stock ; sans 15 ml. */
function formatsOf(r: { regularPrice: number | null; volumes: unknown; stock: number; variants: { volumeLabel: string; code: string | null; stock: number }[] }): Fmt[] {
  const vols = (Array.isArray(r.volumes) ? (r.volumes as { label?: string; price?: number; code?: string }[]) : []).filter((v) => v.label);
  const out: Fmt[] = vols.map((v) => {
    const variant = r.variants.find((x) => keyOf(x.volumeLabel) === keyOf(v.label!));
    return { label: v.label!, price: Number(v.price) || 0, code: variant?.code ?? v.code ?? null, stock: variant ? variant.stock : r.variants.length ? 0 : r.stock };
  });
  for (const x of r.variants) {
    if (!out.some((f) => keyOf(f.label) === keyOf(x.volumeLabel))) out.push({ label: x.volumeLabel, price: r.regularPrice ?? 0, code: x.code, stock: x.stock });
  }
  return sellableVolumes(out).filter((f) => !isUnsoldFormat(f.label) || out.every((o) => isUnsoldFormat(o.label)));
}

export async function searchProductsForOrder(query: string): Promise<ProductSearchResult[]> {
  const q = query.trim().slice(0, 80);
  if (!q || !(await auth())?.user) return [];
  // Même moteur que la recherche du site : nom, code, numéro de fiche, catégorie, parfum d'inspiration, fautes de frappe.
  const ranked = await searchCatalog(q, 15).catch(() => null);
  const ids = ranked?.hits.map((h) => h.doc.id) ?? [];
  const rows = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, choganCode: true, number: true, category: true, regularPrice: true, volumes: true, photo: true, stock: true, variants: { select: { volumeLabel: true, code: true, stock: true } } } })
    : await prisma.product.findMany({
        where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { choganCode: { startsWith: q, mode: "insensitive" } }, ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : [])] },
        take: 15,
        select: { id: true, name: true, choganCode: true, number: true, category: true, regularPrice: true, volumes: true, photo: true, stock: true, variants: { select: { volumeLabel: true, code: true, stock: true } } },
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
    // Formats en vente seulement (pas de 15 ml ni de recharge).
    volumes: r.volumes ? sellableVolumes(r.volumes as { label: string; price: number }[]) : null,
    formats: formatsOf(r),
    photo: r.photo,
  }));
}
