/**
 * Prix des articles d'une commande recalculés à partir du catalogue (jamais ceux du navigateur).
 * Même règle que le panier public : prix d'un volume connu, prix échantillon, ou prix unique.
 * Fichier serveur uniquement.
 */
import { prisma } from "@/lib/prisma";

export type PricedItem = { productId: string; productName: string; volumeLabel: string; price: number; quantity: number };

export async function priceItemsFromCatalog(items: { productId: string; volumeLabel: string; quantity: number }[]): Promise<{ items: PricedItem[]; total: number }> {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Ajoutez au moins un produit");
  if (items.length > 50) throw new Error("Trop d'articles dans une seule commande");
  const ids = [...new Set(items.map((i) => String(i.productId)))];
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, volumes: true, regularPrice: true, testerPrice: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const priced: PricedItem[] = [];
  let total = 0;
  for (const raw of items) {
    const product = byId.get(String(raw.productId));
    if (!product) throw new Error("Un produit n'existe plus : retirez-le de la commande.");
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) throw new Error(`Quantité invalide pour « ${product.name} ».`);
    const volumeLabel = String(raw.volumeLabel ?? "").slice(0, 80);
    const volumes = (product.volumes as { label: string; price: number }[] | null) ?? [];
    const volume = volumes.find((v) => v.label === volumeLabel);
    let price: number | null = null;
    if (volume) price = volume.price;
    else if (volumeLabel.toLowerCase().includes("échantillon") && product.testerPrice != null) price = product.testerPrice;
    else if (!volumes.length && product.regularPrice != null) price = product.regularPrice;
    if (!price || price <= 0) throw new Error(`Prix introuvable pour « ${product.name} » (${volumeLabel}).`);
    priced.push({ productId: product.id, productName: product.name, volumeLabel, price, quantity });
    total += price * quantity;
  }
  return { items: priced, total };
}
