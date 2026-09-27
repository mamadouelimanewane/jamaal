import { prisma } from "./prisma";

interface StockItem {
  productId?: string | null;
  quantity: number;
}

/**
 * Décrémente le stock des produits d'une commande et notifie tous les
 * administrateurs quand un produit passe sous son seuil d'alerte.
 */
export async function decrementStockAndAlert(items: StockItem[]) {
  for (const item of items) {
    if (!item.productId) continue;

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, lowStockThreshold: true, name: true },
    });
    if (!product) continue;

    const newStock = Math.max(0, product.stock - item.quantity);
    await prisma.product.update({ where: { id: item.productId }, data: { stock: newStock } });

    const wasAboveThreshold = product.stock > product.lowStockThreshold;
    const nowAtOrBelowThreshold = newStock <= product.lowStockThreshold;

    if (wasAboveThreshold && nowAtOrBelowThreshold) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            title: "Stock bas",
            message: `${product.name} : il ne reste que ${newStock} unité(s) en stock.`,
          })),
        });
      }
    }
  }
}
