import type { OfferCardData } from "@/components/OfferCard";
import { minPriceOf, type PublicOffer } from "@/lib/offers-public";

/** Données sérialisables d'un coffret pour la carte (format le moins cher de chaque produit). */
export function toOfferCard(o: PublicOffer): OfferCardData {
  return {
    slug: o.slug,
    title: o.title,
    occasion: o.occasion,
    description: o.description,
    image: o.image,
    packPrice: o.packPrice,
    value: o.value,
    endsAt: o.endsAt.toISOString(),
    products: o.products.map((p) => {
      const price = minPriceOf(p);
      const vol = p.volumes?.find((v) => v.price === price);
      return { id: p.id, slug: p.slug, name: p.name, photo: p.photo, colorFrom: p.colorFrom, colorTo: p.colorTo, volumeLabel: vol?.label ?? "Format unique", price };
    }),
  };
}
