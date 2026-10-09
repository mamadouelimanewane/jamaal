/**
 * Moteur de stock JAMAAL.
 *
 * - Le stock se tient par format (ProductVariant : 70 ml, 30 ml, 15 ml…) quand le produit en a,
 *   sinon au niveau du produit (« format unique »).
 * - Toute variation passe par `moveStock` : mise à jour atomique + ligne d'historique
 *   (StockMovement) avec le type, l'auteur, la commande ou la référence.
 * - Une commande retire son stock à la création (RESERVE) ; une annulation le remet (LIBERE),
 *   une seule fois, même si l'annulation est répétée ; une commande « désannulée » le reprend.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;

export type MovementKind = "VENTE" | "ANNULATION" | "RECEPTION" | "INVENTAIRE" | "PERTE" | "RETOUR" | "AJUSTEMENT";

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  VENTE: "Vente",
  ANNULATION: "Annulation de commande",
  RECEPTION: "Réception fournisseur",
  INVENTAIRE: "Inventaire",
  PERTE: "Casse / perte",
  RETOUR: "Retour client",
  AJUSTEMENT: "Ajustement",
};

export const UNIQUE_FORMAT = "Format unique";

export interface StockRef {
  productId: string;
  variantId: string | null;
  label: string;
}

export interface LowStockAlert {
  name: string;
  newStock: number;
}

export class StockError extends Error {}

/**
 * Trouve l'emplacement de stock d'un article : le format demandé, sinon (ancien panier,
 * « Format unique ») le format principal du produit, sinon le produit lui-même.
 */
export async function resolveStockRef(tx: Tx, productId: string, volumeLabel?: string | null): Promise<StockRef | null> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, choganCode: true, variants: { select: { id: true, volumeLabel: true, code: true }, orderBy: { id: "asc" } } },
  });
  if (!product) return null;
  if (!product.variants.length) return { productId, variantId: null, label: UNIQUE_FORMAT };
  const exact = product.variants.find((v) => v.volumeLabel === volumeLabel);
  if (exact) return { productId, variantId: exact.id, label: exact.volumeLabel };
  const main = product.variants.find((v) => v.code && v.code === product.choganCode) ?? product.variants[0];
  return { productId, variantId: main.id, label: main.volumeLabel };
}

export interface MoveOptions {
  kind: MovementKind;
  reason?: string;
  userId?: string | null;
  orderId?: string | null;
  reference?: string | null;
  /** Vente : refuse si le stock est insuffisant (sinon le stock est ramené à 0 au plus bas). */
  strict?: boolean;
}

/**
 * Applique une variation de stock. Retourne l'ancien et le nouveau stock, et si le seuil
 * d'alerte vient d'être franchi.
 */
export async function moveStock(tx: Tx, ref: StockRef, delta: number, opts: MoveOptions) {
  if (!Number.isInteger(delta)) throw new StockError("La quantité doit être un nombre entier.");
  const row = ref.variantId
    ? await tx.productVariant.findUnique({ where: { id: ref.variantId }, select: { stock: true, lowStockThreshold: true } })
    : await tx.product.findUnique({ where: { id: ref.productId }, select: { stock: true, lowStockThreshold: true } });
  if (!row) throw new StockError("Article introuvable.");

  let applied = delta;
  if (delta < 0) {
    // Retrait atomique : la condition empêche deux ventes simultanées de passer sous zéro.
    const need = -delta;
    const res = ref.variantId
      ? await tx.productVariant.updateMany({ where: { id: ref.variantId, stock: { gte: need } }, data: { stock: { decrement: need } } })
      : await tx.product.updateMany({ where: { id: ref.productId, stock: { gte: need } }, data: { stock: { decrement: need } } });
    if (res.count === 0) {
      if (opts.strict) throw new StockError(`stock insuffisant (${ref.label} : ${row.stock} disponible${row.stock > 1 ? "s" : ""}).`);
      // Vente déjà conclue (commande vendeur) ou perte : on descend jusqu'à 0 et on trace l'écart.
      applied = -row.stock;
      if (applied !== 0) {
        if (ref.variantId) await tx.productVariant.update({ where: { id: ref.variantId }, data: { stock: 0 } });
        else await tx.product.update({ where: { id: ref.productId }, data: { stock: 0 } });
      }
    }
  } else if (delta > 0) {
    if (ref.variantId) await tx.productVariant.update({ where: { id: ref.variantId }, data: { stock: { increment: delta } } });
    else await tx.product.update({ where: { id: ref.productId }, data: { stock: { increment: delta } } });
  }

  const previousStock = row.stock;
  const nextStock = previousStock + applied;
  if (applied !== 0 || opts.kind === "INVENTAIRE") {
    const shortfall = delta < 0 && applied !== delta ? ` (il manquait ${applied - delta})` : "";
    await tx.stockMovement.create({
      data: {
        productId: ref.productId,
        variantId: ref.variantId,
        userId: opts.userId ?? null,
        delta: applied,
        previousStock,
        nextStock,
        kind: opts.kind,
        orderId: opts.orderId ?? null,
        reference: opts.reference?.slice(0, 80) || null,
        reason: ((opts.reason || MOVEMENT_LABELS[opts.kind]) + shortfall).slice(0, 200),
      },
    });
  }
  const crossed = previousStock > row.lowStockThreshold && nextStock <= row.lowStockThreshold;
  return { previousStock, nextStock, applied, crossed, threshold: row.lowStockThreshold };
}

/** Inventaire : fixe le stock compté (enregistre l'écart, même nul). */
export async function setStock(tx: Tx, ref: StockRef, counted: number, opts: Omit<MoveOptions, "kind" | "strict">) {
  if (!Number.isInteger(counted) || counted < 0) throw new StockError("Le stock compté doit être un entier positif ou nul.");
  const row = ref.variantId
    ? await tx.productVariant.findUnique({ where: { id: ref.variantId }, select: { stock: true } })
    : await tx.product.findUnique({ where: { id: ref.productId }, select: { stock: true } });
  if (!row) throw new StockError("Article introuvable.");
  return moveStock(tx, ref, counted - row.stock, { ...opts, kind: "INVENTAIRE", strict: false });
}

interface SaleItem {
  productId?: string | null;
  volumeLabel?: string;
  quantity: number;
}

async function productName(tx: Tx, productId: string) {
  return (await tx.product.findUnique({ where: { id: productId }, select: { name: true } }))?.name ?? "";
}

/**
 * Retire du stock les articles d'une commande. `strict` : refuse la commande en cas de stock
 * insuffisant (boutique). Retourne les alertes de stock bas à envoyer APRÈS la transaction.
 */
export async function reserveStock(tx: Tx, items: SaleItem[], strict = true, ctx: { orderId?: string | null; userId?: string | null } = {}): Promise<LowStockAlert[]> {
  const alerts: LowStockAlert[] = [];
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    const ref = await resolveStockRef(tx, item.productId, item.volumeLabel);
    if (!ref) continue;
    try {
      const r = await moveStock(tx, ref, -item.quantity, {
        kind: "VENTE",
        strict,
        orderId: ctx.orderId,
        userId: ctx.userId,
        reason: ctx.orderId ? `Vente · commande ${ctx.orderId.slice(-8).toUpperCase()}` : undefined,
      });
      if (r.crossed) alerts.push({ name: `${await productName(tx, ref.productId)}${ref.variantId ? ` — ${ref.label}` : ""}`, newStock: r.nextStock });
    } catch (e) {
      if (e instanceof StockError) throw new StockError(`« ${await productName(tx, ref.productId)} » : ${e.message} Merci d'ajuster votre panier.`);
      throw e;
    }
  }
  if (ctx.orderId) await tx.order.update({ where: { id: ctx.orderId }, data: { stockState: "RESERVE" } });
  return alerts;
}

/**
 * Met le stock d'une commande en accord avec son statut : annulée → articles remis en stock,
 * de nouveau active → articles repris. Sans effet si c'est déjà le cas (idempotent).
 * Les commandes antérieures au suivi (stockState vide) sont considérées comme réservées.
 */
export async function syncOrderStock(orderId: string, userId?: string | null) {
  const alerts: LowStockAlert[] = [];
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, stockState: true, items: { select: { productId: true, variantId: true, volumeLabel: true, quantity: true } } },
    });
    if (!order) return;
    const reserved = order.stockState !== "LIBERE";
    const refOf = async (item: (typeof order.items)[number]) =>
      item.variantId ? { productId: item.productId!, variantId: item.variantId, label: item.volumeLabel } : resolveStockRef(tx, item.productId!, item.volumeLabel);

    if (order.status === "ANNULEE" && reserved) {
      const claim = await tx.order.updateMany({ where: { id: orderId, OR: [{ stockState: null }, { stockState: "RESERVE" }] }, data: { stockState: "LIBERE" } });
      if (!claim.count) return;
      for (const item of order.items) {
        if (!item.productId) continue;
        const ref = await refOf(item);
        if (ref) await moveStock(tx, ref, item.quantity, { kind: "ANNULATION", orderId, userId, reason: `Annulation · commande ${orderId.slice(-8).toUpperCase()}` });
      }
    } else if (order.status !== "ANNULEE" && !reserved) {
      const claim = await tx.order.updateMany({ where: { id: orderId, stockState: "LIBERE" }, data: { stockState: "RESERVE" } });
      if (!claim.count) return;
      for (const item of order.items) {
        if (!item.productId) continue;
        const ref = await refOf(item);
        if (!ref) continue;
        const r = await moveStock(tx, ref, -item.quantity, { kind: "VENTE", strict: false, orderId, userId, reason: `Commande réactivée · ${orderId.slice(-8).toUpperCase()}` });
        if (r.crossed) alerts.push({ name: await productName(tx, item.productId), newStock: r.nextStock });
      }
    }
  });
  await sendLowStockAlerts(alerts);
}

async function notifyLowStock(name: string, newStock: number) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title: newStock <= 0 ? "Rupture de stock" : "Stock bas",
      message: newStock <= 0 ? `${name} est en rupture de stock.` : `${name} : il ne reste que ${newStock} unité(s) en stock.`,
    })),
  });
}

export async function sendLowStockAlerts(alerts: LowStockAlert[]) {
  for (const a of alerts) await notifyLowStock(a.name, a.newStock).catch((e) => console.error("[stock] alerte", e));
}

/** Commandes saisies par un vendeur (vente déjà conclue) : retrait non bloquant. */
export async function decrementStockAndAlert(items: SaleItem[], ctx: { orderId?: string | null; userId?: string | null } = {}) {
  const alerts = await prisma.$transaction((tx) => reserveStock(tx, items, false, ctx));
  await sendLowStockAlerts(alerts);
}
