"use server";

import { prisma } from "@/lib/prisma";

export type CartPriceQuery = { productId: string; volumeLabel: string };
/** price = prix actuel ; null = article plus disponible à la vente. */
export type CartPrice = CartPriceQuery & { price: number | null };

/**
 * Prix actuels des articles d'un panier (même règle que createOrder) : permet au panier
 * enregistré dans le navigateur de se remettre à jour après un changement de prix.
 */
export async function getCartPrices(items: CartPriceQuery[]): Promise<CartPrice[]> {
  const list = items.slice(0, 50).filter((i) => typeof i.productId === "string" && typeof i.volumeLabel === "string");
  if (!list.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(list.map((i) => i.productId))] } },
    select: { id: true, regularPrice: true, testerPrice: true, volumes: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return list.map((item) => {
    const product = byId.get(item.productId);
    if (!product) return { ...item, price: null };
    const volumes = (product.volumes as { label: string; price: number }[] | null) ?? [];
    const volume = volumes.find((v) => v.label === item.volumeLabel);
    if (volume) return { ...item, price: volume.price };
    if (item.volumeLabel.toLowerCase().includes("échantillon") && product.testerPrice != null) {
      return { ...item, price: product.testerPrice };
    }
    if (!volumes.length && product.regularPrice != null) return { ...item, price: product.regularPrice };
    return { ...item, price: null };
  });
}
