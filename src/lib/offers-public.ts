/** Offres de fêtes en cours, avec leurs produits (pour l'accueil, /offres et le panier). */
import { prisma } from "@/lib/prisma";
import { getProductsByIds } from "@/lib/db-products";
import type { Product } from "@/data/types";

export interface PublicOffer {
  id: string;
  slug: string;
  title: string;
  occasion: string | null;
  description: string;
  image: string | null;
  packPrice: number;
  value: number;
  endsAt: Date;
  products: Product[];
}

export const minPriceOf = (p: Product) => (p.volumes?.length ? Math.min(...p.volumes.map((v) => v.price)) : p.regularPrice ?? 0);

export async function getLiveOffers(opts: { slug?: string } = {}): Promise<PublicOffer[]> {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now }, ...(opts.slug ? { slug: opts.slug } : {}) },
    orderBy: { endsAt: "asc" },
    take: 12,
  });
  const products = await getProductsByIds([...new Set(offers.flatMap((o) => o.productIds))]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return offers
    .map((o) => {
      const list = [...new Set(o.productIds)].map((id) => byId.get(id)).filter((p): p is Product => !!p);
      return { expected: new Set(o.productIds).size, id: o.id, slug: o.slug, title: o.title, occasion: o.occasion, description: o.description, image: o.image, packPrice: o.packPrice, value: list.reduce((s, p) => s + minPriceOf(p), 0), endsAt: o.endsAt, products: list };
    })
    .filter((o) => o.products.length === o.expected && o.products.length >= 2 && o.value > o.packPrice)
    .map((o) => ({ id: o.id, slug: o.slug, title: o.title, occasion: o.occasion, description: o.description, image: o.image, packPrice: o.packPrice, value: o.value, endsAt: o.endsAt, products: o.products }));
}
