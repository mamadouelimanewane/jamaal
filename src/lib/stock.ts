import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

interface StockItem {
  productId?: string | null;
  volumeLabel?: string;
  quantity: number;
}

export interface LowStockAlert {
  name: string;
  newStock: number;
}

type Tx = Prisma.TransactionClient;

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

export async function sendLowStockAlerts(alerts: LowStockAlert[]) {
  for (const a of alerts) await notifyLowStock(a.name, a.newStock);
}

/**
 * Décrémente le stock de façon atomique (UPDATE conditionnel) au niveau de la
 * variante si elle existe, sinon au niveau du produit.
 * - strict = true : lève une erreur si le stock est insuffisant (la transaction
 *   appelante est alors annulée).
 * - strict = false : plafonne le stock à 0 (commandes saisies par un consultant).
 * Retourne les alertes de stock bas à envoyer APRÈS le commit.
 */
export async function reserveStock(
  tx: Tx,
  items: StockItem[],
  strict = true
): Promise<LowStockAlert[]> {
  const alerts: LowStockAlert[] = [];

  for (const item of items) {
    if (!item.productId) continue;

    const variant = item.volumeLabel
      ? await tx.productVariant.findUnique({
          where: { productId_volumeLabel: { productId: item.productId, volumeLabel: item.volumeLabel } },
        })
      : null;

    if (variant) {
      const res = await tx.productVariant.updateMany({
        where: { id: variant.id, ...(strict ? { stock: { gte: item.quantity } } : {}) },
        data: { stock: { decrement: item.quantity } },
      });
      if (res.count === 0) {
        throw new Error(`Stock insuffisant pour ${item.volumeLabel}. Merci de rafraîchir votre panier.`);
      }
      const fresh = await tx.productVariant.findUnique({ where: { id: variant.id } });
      if (fresh && fresh.stock < 0) {
        await tx.productVariant.update({ where: { id: variant.id }, data: { stock: 0 } });
        fresh.stock = 0;
      }
      if (fresh && variant.stock > variant.lowStockThreshold && fresh.stock <= variant.lowStockThreshold) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        alerts.push({ name: `${product?.name ?? ""} — ${item.volumeLabel}`, newStock: fresh.stock });
      }
      continue;
    }

    const before = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, lowStockThreshold: true, name: true },
    });
    if (!before) continue;

    const res = await tx.product.updateMany({
      where: { id: item.productId, ...(strict ? { stock: { gte: item.quantity } } : {}) },
      data: { stock: { decrement: item.quantity } },
    });
    if (res.count === 0) {
      throw new Error(`Stock insuffisant pour « ${before.name} ». Merci de rafraîchir votre panier.`);
    }
    const after = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true } });
    let newStock = after?.stock ?? 0;
    if (newStock < 0) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: 0 } });
      newStock = 0;
    }
    if (before.stock > before.lowStockThreshold && newStock <= before.lowStockThreshold) {
      alerts.push({ name: before.name, newStock });
    }
  }

  return alerts;
}

/** Variante non stricte pour les commandes déjà créées (flux consultant). */
export async function decrementStockAndAlert(items: StockItem[]) {
  const alerts = await prisma.$transaction((tx) => reserveStock(tx, items, false));
  await sendLowStockAlerts(alerts);
}
