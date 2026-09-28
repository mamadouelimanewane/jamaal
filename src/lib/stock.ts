import { prisma } from "./prisma";

interface StockItem {
  productId?: string | null;
  volumeLabel?: string;
  quantity: number;
}

async function notifyLowStock(name: string, newStock: number) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title: "Stock bas",
      message: `${name} : il ne reste que ${newStock} unité(s) en stock.`,
    })),
  });
}

/**
 * Décrémente le stock des produits d'une commande (au niveau de la variante
 * si elle existe, sinon au niveau du produit) et notifie tous les
 * administrateurs quand on passe sous le seuil d'alerte.
 */
export async function decrementStockAndAlert(items: StockItem[]) {
  for (const item of items) {
    if (!item.productId) continue;

    const variant = item.volumeLabel
      ? await prisma.productVariant.findUnique({
          where: { productId_volumeLabel: { productId: item.productId, volumeLabel: item.volumeLabel } },
        })
      : null;

    if (variant) {
      const newStock = Math.max(0, variant.stock - item.quantity);
      await prisma.productVariant.update({ where: { id: variant.id }, data: { stock: newStock } });
      const wasAbove = variant.stock > variant.lowStockThreshold;
      const nowBelow = newStock <= variant.lowStockThreshold;
      if (wasAbove && nowBelow) {
        const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        await notifyLowStock(`${product?.name ?? ""} — ${item.volumeLabel}`, newStock);
      }
      continue;
    }

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
      await notifyLowStock(product.name, newStock);
    }
  }
}
