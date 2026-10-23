/**
 * Boutique personnelle d'un consultant (/c/<slug>) : sa fiche, ses coups de cœur (choisis par lui, sinon ses
 * meilleures ventes, sinon les meilleures ventes JAMAAL) et des avis clients (de ses clients d'abord). Serveur.
 */
import { prisma } from "@/lib/prisma";
import { startingPrice } from "@/lib/reseller-catalog";
import { effectiveTitle, depthFromLoaded } from "@/lib/network";

export const MAX_FAVORITES = 8;

export type ShopProduct = { id: string; slug: string; name: string; photo: string | null; price: number | null; multiFormat: boolean; inspiredBy: string | null };
export type ShopReview = { id: string; author: string; rating: number; comment: string; product: string; photo: string | null; mine: boolean };

const productSelect = { id: true, slug: true, name: true, photo: true, regularPrice: true, volumes: true, inspiredBy: true } as const;
type Row = { id: string; slug: string; name: string; photo: string | null; regularPrice: number | null; volumes: unknown; inspiredBy: string | null };
const toShop = (r: Row): ShopProduct => ({ id: r.id, slug: r.slug, name: r.name, photo: r.photo, price: startingPrice(r.regularPrice, r.volumes), multiFormat: Array.isArray(r.volumes) && r.volumes.length > 1, inspiredBy: r.inspiredBy });

/** Ordre des coups de cœur : ceux choisis par le consultant, dans son ordre ; produits disparus ignorés. Pur, testé. */
export function orderFavorites<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return [...new Set(ids)].map((id) => byId.get(id)).filter((r): r is T => !!r).slice(0, MAX_FAVORITES);
}

async function topSoldIds(consultantId: string | null, take: number): Promise<string[]> {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { status: { not: "ANNULEE" }, ...(consultantId ? { consultantId } : { createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }) } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take,
  });
  return rows.map((r) => r.productId!).filter(Boolean);
}

export async function getConsultantShop(slug: string) {
  const c = await prisma.consultant.findFirst({
    where: { slug: slug.trim().toLowerCase(), active: true },
    select: { id: true, name: true, city: true, whatsapp: true, slug: true, rank: true, shopPhoto: true, shopBio: true, favorites: true, createdAt: true, sponsorId: true, sponsor: { select: { sponsorId: true } } },
  });
  if (!c) return null;

  // Coups de cœur : son choix, sinon ses meilleures ventes, sinon celles de JAMAAL (produits avec photo).
  let products: ShopProduct[] = [];
  if (c.favorites.length) {
    const rows = await prisma.product.findMany({ where: { id: { in: c.favorites } }, select: productSelect });
    products = orderFavorites(c.favorites, rows).map(toShop);
  }
  const chosen = products.length > 0;
  if (!products.length) {
    let ids = await topSoldIds(c.id, MAX_FAVORITES);
    if (ids.length < 4) ids = [...new Set([...ids, ...(await topSoldIds(null, MAX_FAVORITES * 2))])];
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, photo: { not: null } }, select: productSelect });
    products = orderFavorites(ids, rows).map(toShop);
    if (products.length < 4) {
      const more = await prisma.product.findMany({ where: { photo: { not: null }, id: { notIn: products.map((p) => p.id) } }, orderBy: { reviewCount: "desc" }, take: 6 - products.length, select: productSelect });
      products = [...products, ...more.map(toShop)];
    }
  }

  // Avis : de ses clients d'abord, complétés par les derniers avis JAMAAL (approuvés, avec commentaire).
  const reviewSelect = { id: true, authorName: true, rating: true, comment: true, photo: true, product: { select: { name: true } } } as const;
  const orderIds = (await prisma.order.findMany({ where: { consultantId: c.id }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 500 })).map((o) => o.id);
  const mine = orderIds.length ? await prisma.review.findMany({ where: { approved: true, orderId: { in: orderIds }, rating: { gte: 4 } }, orderBy: { createdAt: "desc" }, take: 6, select: reviewSelect }) : [];
  const others = mine.length < 3 ? await prisma.review.findMany({ where: { approved: true, rating: { gte: 4 }, id: { notIn: mine.map((r) => r.id) }, comment: { not: "" } }, orderBy: { createdAt: "desc" }, take: 6 - mine.length, select: reviewSelect }) : [];
  const reviews: ShopReview[] = [...mine.map((r) => ({ r, mine: true })), ...others.map((r) => ({ r, mine: false }))].map(({ r, mine: m }) => ({ id: r.id, author: r.authorName, rating: r.rating, comment: r.comment, product: r.product.name, photo: r.photo, mine: m }));

  const [clients, rating] = await Promise.all([
    prisma.order.findMany({ where: { consultantId: c.id, status: { not: "ANNULEE" }, customerPhone: { not: null } }, distinct: ["customerPhone"], select: { customerPhone: true } }).then((r) => r.length),
    mine.length ? Promise.resolve(mine.reduce((s, r) => s + r.rating, 0) / mine.length) : Promise.resolve(null),
  ]);

  return {
    consultant: { id: c.id, name: c.name, city: c.city, whatsapp: c.whatsapp, slug: c.slug!, photo: c.shopPhoto, bio: c.shopBio, title: effectiveTitle(c.rank, depthFromLoaded(c)), since: c.createdAt },
    products,
    chosen,
    reviews,
    stats: { clients, rating },
  };
}

/** Lien WhatsApp du consultant avec un premier message. Pur, testé. */
export function shopWhatsAppLink(whatsapp: string, text: string): string | null {
  if (/^https?:\/\//.test(whatsapp)) return whatsapp;
  let d = whatsapp.replace(/\D/g, "").replace(/^00/, "");
  if (d.length === 9) d = `221${d}`;
  return d.length >= 11 ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}
