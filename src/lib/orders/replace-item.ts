/**
 * Remplacement d'un produit dans une commande pas encore livrée (produit en rupture, erreur de choix…), par le client
 * depuis le lien de sa commande, par son revendeur ou par l'admin.
 *
 * Écart de prix :
 * - commande pas encore payée : le nouveau total est simplement à payer ;
 * - commande payée, produit plus cher : le paiement est rouvert pour le complément (statut « En attente ») ;
 * - commande payée, produit moins cher : la différence va dans l'avoir du client (wallet client) ;
 * - commande payée avec le wallet du revendeur (ou encaissée par lui) : l'écart passe sur son wallet ;
 * - réservation : l'acompte payé reste acquis, le solde à l'arrivée suit le nouveau prix.
 * Stock, commissions et historique sont mis à jour ; le client, le revendeur et l'équipe sont prévenus.
 * Fichier serveur.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { isUnsoldFormat, sellableVolumes } from "@/lib/price-from";
import { moveStock, resolveStockRef, checkStockAvailable, STOCK_PENDING, StockError } from "@/lib/stock";
import { depositFor } from "@/lib/reservation";
import { getReservationSettings } from "@/lib/reservation-store";
import { commissionBase } from "@/lib/commission";
import { creditAvoir, customerOfOrder } from "@/lib/customer-wallet";
import { walletBalance } from "@/lib/wallet";
import { COLLECT_REF_PREFIX } from "@/lib/special-terms";
import { sendWhatsApp, notifyTeamWhatsApp } from "@/lib/whatsapp";
import { getSiteUrl } from "@/lib/site-url";

export type ReplaceActor = { role: "CLIENT" | "REVENDEUR" | "ADMIN"; name?: string | null; consultantId?: string | null };
export type Settlement = "AUCUN" | "COMPLEMENT" | "AVOIR" | "WALLET";

export class ReplaceError extends Error {}

type OrderState = {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryStatus: string | null;
  installmentCount: number;
  isReservation: boolean;
  reservationStatus: string | null;
};

/** Pourquoi la commande ne peut plus être modifiée (null : remplacement possible). Pur. */
export function replacementRefusal(o: OrderState, role: ReplaceActor["role"]): string | null {
  if (o.status === "ANNULEE") return "Cette commande est annulée.";
  if (o.status === "LIVREE" || o.deliveryStatus === "LIVREE") return "Cette commande est déjà livrée.";
  if (o.status === "EXPEDIEE" || o.deliveryStatus === "RECUPEREE" || o.deliveryStatus === "EN_ROUTE") return "Le colis est déjà parti : il ne peut plus être modifié.";
  if (o.installmentCount >= 2) return "Commande payée en plusieurs fois : pour changer un produit, contactez JAMAAL sur WhatsApp.";
  if (o.isReservation && (o.reservationStatus === "SOLDEE" || o.reservationStatus === "ANNULEE")) return "Cette réservation ne peut plus être modifiée.";
  if (role === "CLIENT" && o.paymentMethod === "WALLET") return "Commande réglée par votre conseiller : demandez-lui de changer le produit.";
  return null;
}

/** Comment l'écart est réglé. Pur. */
export function settlementFor(o: Pick<OrderState, "paymentStatus" | "paymentMethod" | "isReservation"> & { paidBeforeChange: number; depositPaid: boolean }, diff: number): Settlement {
  if (diff === 0) return "AUCUN";
  if (o.paymentMethod === "WALLET" && o.paymentStatus === "PAYE") return "WALLET";
  if (o.isReservation) return "AUCUN"; // l'écart se règle avec le solde à l'arrivée (ou part dans l'avoir si l'acompte dépasse le prix)
  const paid = o.paymentStatus === "PAYE" || o.paidBeforeChange > 0;
  if (!paid) return "AUCUN";
  return diff > 0 ? "COMPLEMENT" : "AVOIR";
}

export type ReplaceResult = { ok: true; message: string; difference: number; settlement: Settlement; toPay: number; avoir: number } | { ok: false; error: string };

export async function replaceOrderItem(input: { orderId: string; itemId: string; productId: string; volumeLabel: string; actor: ReplaceActor }): Promise<ReplaceResult> {
  try {
    return await doReplace(input);
  } catch (e) {
    if (e instanceof ReplaceError || e instanceof StockError) return { ok: false, error: e.message };
    console.error("[remplacement]", input.orderId, e);
    return { ok: false, error: "Le remplacement n'a pas pu être enregistré. Réessayez ou contactez JAMAAL sur WhatsApp." };
  }
}

async function doReplace({ orderId, itemId, productId, volumeLabel, actor }: { orderId: string; itemId: string; productId: string; volumeLabel: string; actor: ReplaceActor }): Promise<ReplaceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new ReplaceError("Commande introuvable.");
  if (actor.role === "REVENDEUR" && (!actor.consultantId || order.consultantId !== actor.consultantId)) throw new ReplaceError("Cette commande n'est pas la vôtre.");
  const refusal = replacementRefusal(order, actor.role);
  if (refusal) throw new ReplaceError(refusal);
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new ReplaceError("Article introuvable dans la commande.");

  // Nouveau produit : prix du format choisi, format vendu.
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, volumes: true, regularPrice: true } }).catch(() => null);
  if (!product) throw new ReplaceError("Produit introuvable.");
  const volumes = (product.volumes as { label: string; price: number }[] | null) ?? [];
  const volume = volumes.length ? volumes.find((v) => v.label === volumeLabel) : product.regularPrice != null ? { label: volumeLabel || "Format unique", price: product.regularPrice } : null;
  if (!volume) throw new ReplaceError("Choisissez un format de ce produit.");
  if (isUnsoldFormat(volume.label) && sellableVolumes(volumes).some((v) => !isUnsoldFormat(v.label))) throw new ReplaceError(`Le format « ${volume.label} » n'est plus vendu : choisissez-en un autre.`);
  if (product.id === item.productId && volume.label === item.volumeLabel) throw new ReplaceError("C'est déjà ce produit.");

  const qty = item.quantity;
  const diff = (volume.price - item.price) * qty;
  const depositPaid = !!order.depositPaidAt;
  const settlement = settlementFor({ ...order, depositPaid }, diff);
  const newTotal = order.total + diff;
  if (newTotal < 0) throw new ReplaceError("Remplacement impossible sur cette commande : contactez JAMAAL.");

  // Montants à régler ou à rendre.
  let paidBeforeChange = order.paidBeforeChange;
  let paymentStatus = order.paymentStatus;
  let status = order.status;
  let avoir = 0;
  let toPay = 0;
  let depositAmount = order.depositAmount;
  if (settlement === "COMPLEMENT") {
    // Payée, produit plus cher : on garde ce qui est payé, le complément est à payer (statut « En attente »).
    paidBeforeChange = order.paymentStatus === "PAYE" ? order.total : order.paidBeforeChange;
    paymentStatus = "EN_ATTENTE";
    if (status === "CONFIRMEE" || status === "NON_PAYEE") status = "EN_ATTENTE";
    toPay = newTotal - paidBeforeChange;
  } else if (settlement === "AVOIR") {
    const paid = order.paymentStatus === "PAYE" ? order.total : order.paidBeforeChange;
    avoir = Math.max(0, paid - newTotal);
    if (order.paymentStatus !== "PAYE") {
      // Un complément était attendu : le nouveau prix est couvert, la commande redevient payée.
      paidBeforeChange = 0;
      if (newTotal <= paid) {
        paymentStatus = "PAYE";
        if (status === "EN_ATTENTE" || status === "NON_PAYEE") status = "CONFIRMEE";
      } else toPay = newTotal - paid;
    }
  } else if (order.isReservation) {
    if (!depositPaid) {
      // Acompte pas encore payé : recalculé sur le nouveau prix.
      const settings = await getReservationSettings();
      const products = order.items.reduce((s, i) => s + (i.id === itemId ? volume.price : i.price) * i.quantity, 0);
      depositAmount = depositFor(products, settings.depositPercent);
      toPay = depositAmount;
    } else if (newTotal < order.depositAmount) {
      // L'acompte payé dépasse le nouveau prix : l'excédent va dans l'avoir.
      avoir = order.depositAmount - Math.max(0, newTotal);
    } else toPay = newTotal - order.depositAmount;
  } else if (paymentStatus !== "PAYE") toPay = newTotal;

  // Wallet du revendeur (commande qu'il a payée avec son wallet ou encaissée lui-même).
  const walletOwner = settlement === "WALLET" && order.consultantId ? { type: "CONSULTANT" as const, id: order.consultantId } : null;
  const collected = (order.paymentRef ?? "").startsWith(COLLECT_REF_PREFIX);

  const stockTaken = !order.isReservation && order.stockState !== STOCK_PENDING && order.stockState !== "LIBERE";
  const change = await prisma.$transaction(async (tx) => {
    // Verrou : deux remplacements simultanés sur la même commande ne passent pas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-change:${orderId}`}))`;
    const fresh = await tx.orderItem.findUnique({ where: { id: itemId }, select: { productId: true, volumeLabel: true, price: true } });
    if (!fresh || fresh.productId !== item.productId || fresh.volumeLabel !== item.volumeLabel || fresh.price !== item.price) throw new ReplaceError("La commande vient de changer : rechargez la page.");

    // Stock : l'ancien produit revient, le nouveau sort (ou sa disponibilité est vérifiée si rien n'est encore prélevé).
    const newRef = await resolveStockRef(tx, product.id, volume.label);
    if (stockTaken) {
      if (item.productId) {
        const oldRef = item.variantId ? { productId: item.productId, variantId: item.variantId, label: item.volumeLabel } : await resolveStockRef(tx, item.productId, item.volumeLabel);
        if (oldRef) await moveStock(tx, oldRef, qty, { kind: "ANNULATION", orderId, reason: `Remplacé dans la commande ${orderId.slice(-8).toUpperCase()}` });
      }
      if (newRef) await moveStock(tx, newRef, -qty, { kind: "VENTE", strict: true, orderId, reason: `Remplacement · commande ${orderId.slice(-8).toUpperCase()}` });
    } else if (!order.isReservation) {
      await checkStockAvailable(tx, [{ productId: product.id, volumeLabel: volume.label, quantity: qty }]);
    }

    if (walletOwner && diff !== 0) {
      if (diff > 0 && !collected) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:CONSULTANT:${walletOwner.id}`}))`;
        const { available } = await walletBalance(walletOwner, tx);
        if (diff > available) throw new ReplaceError(`Solde du wallet insuffisant pour le complément : ${formatPrice(available)} disponibles pour ${formatPrice(diff)}.`);
      }
      await tx.walletTransaction.create({
        data: { ownerType: "CONSULTANT", ownerId: walletOwner.id, amount: -diff, kind: "PAIEMENT", orderId, note: `Remplacement ${diff > 0 ? "plus cher" : "moins cher"} · commande ${orderId.slice(-8).toUpperCase()}`, createdBy: actor.name ?? null },
      });
    }

    await tx.orderItem.update({ where: { id: itemId }, data: { productId: product.id, variantId: newRef?.variantId ?? null, productName: product.name, volumeLabel: volume.label, price: volume.price } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        total: newTotal,
        paidBeforeChange,
        paymentStatus: paymentStatus as Prisma.OrderUpdateInput["paymentStatus"],
        status: status as Prisma.OrderUpdateInput["status"],
        depositAmount,
        ...(avoir > 0 ? { avoirRefunded: { increment: avoir } } : {}),
      },
    });
    if (status !== order.status) await tx.orderStatusHistory.create({ data: { orderId, status: status as Prisma.OrderStatusHistoryCreateInput["status"] } });
    return tx.orderItemChange.create({
      data: {
        orderId,
        oldProductId: item.productId,
        oldName: item.productName,
        oldVolume: item.volumeLabel,
        oldPrice: item.price,
        newProductId: product.id,
        newName: product.name,
        newVolume: volume.label,
        newPrice: volume.price,
        quantity: qty,
        difference: diff,
        settlement: avoir > 0 ? "AVOIR" : settlement,
        byRole: actor.role,
        byName: actor.name?.slice(0, 80) ?? null,
      },
    });
  });

  // Différence rendue dans l'avoir du client.
  if (avoir > 0) {
    const customer = await customerOfOrder(orderId);
    if (customer) {
      await creditAvoir({
        customerId: customer.id,
        amount: avoir,
        orderId,
        sourceId: `remplacement:${change.id}`,
        note: `Remplacement moins cher · commande ${orderId.slice(-8).toUpperCase()}`,
        reason: `vous avez remplacé « ${item.productName} » par « ${product.name} » (${volume.label}) dans votre commande ${orderId.slice(-8).toUpperCase()}.`,
      });
    } else {
      notifyTeamWhatsApp(`⚠️ Avoir à rendre à la main : ${formatPrice(avoir)} (commande ${orderId.slice(-8).toUpperCase()}, client sans numéro).`);
    }
  }
  // Commissions déjà enregistrées : recalculées sur le nouveau montant.
  if (diff !== 0) await adjustCommissions(orderId, change.id).catch((e) => console.error("[remplacement] commissions", orderId, e));

  await notifyReplacement({ orderId, change, toPay, avoir, actor, consultantId: order.consultantId, phone: order.customerPhone ?? order.deliveryContactPhone, customerName: order.customerName, isReservation: order.isReservation }).catch((e) => console.error("[remplacement] messages", orderId, e));

  const message =
    toPay > 0 && settlement === "COMPLEMENT"
      ? `Produit remplacé. Complément à payer : ${formatPrice(toPay)}.`
      : avoir > 0
        ? `Produit remplacé. ${formatPrice(avoir)} ajoutés à l'avoir du client.`
        : settlement === "WALLET"
          ? `Produit remplacé. ${diff > 0 ? `${formatPrice(diff)} débités` : `${formatPrice(-diff)} recrédités`} sur le wallet du revendeur.`
          : "Produit remplacé.";
  return { ok: true, message, difference: diff, settlement, toPay, avoir };
}

/** Commissions déjà enregistrées sur la commande : montant recalculé sur le nouveau total (écart passé au wallet). */
async function adjustCommissions(orderId: string, changeId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { total: true, deliveryFee: true } });
  if (!order) return;
  const base = commissionBase(order);
  const entries = await prisma.commissionEntry.findMany({ where: { orderId, status: { in: ["A_VERSER", "EN_REVUE", "WALLET"] }, payoutId: null } });
  for (const e of entries) {
    const amount = Math.round((base * e.rate) / 100);
    const delta = amount - e.amount;
    if (delta === 0) continue;
    await prisma.commissionEntry.update({ where: { id: e.id }, data: { amount, base } });
    if (e.status === "WALLET") {
      await prisma.walletTransaction.upsert({
        where: { sourceId: `ce-adj:${e.id}:${changeId}` },
        update: {},
        create: { ownerType: "CONSULTANT", ownerId: e.consultantId, amount: delta, kind: "COMMISSION", sourceId: `ce-adj:${e.id}:${changeId}`, orderId, note: `Commission ajustée (produit remplacé) · commande ${orderId.slice(-8).toUpperCase()}` },
      });
    }
  }
}

async function notifyReplacement(p: {
  orderId: string;
  change: { oldName: string; oldVolume: string; newName: string; newVolume: string; difference: number };
  toPay: number;
  avoir: number;
  actor: ReplaceActor;
  consultantId: string | null;
  phone: string | null;
  customerName: string;
  isReservation: boolean;
}) {
  const short = p.orderId.slice(-8).toUpperCase();
  const what = `« ${p.change.oldName} (${p.change.oldVolume}) » remplacé par « ${p.change.newName} (${p.change.newVolume}) »`;
  const site = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  // Client : confirmation (l'avoir a son propre message).
  if (p.phone) {
    const first = p.customerName.split(/\s+/)[0] || p.customerName;
    const money =
      p.toPay > 0 && !p.isReservation
        ? ` Complément à payer : ${formatPrice(p.toPay)}, en ligne ici : ${site}/commande/${p.orderId} (ou à la remise du colis).`
        : p.isReservation && p.toPay > 0
          ? ` ${p.toPay === p.change.difference ? "" : `Montant à régler : ${formatPrice(p.toPay)}.`}`
          : "";
    await sendWhatsApp({ to: p.phone, text: `Bonjour ${first}, votre commande ${short} est modifiée : ${what}.${money}`.trim(), kind: "client" });
  }
  // Revendeur : notification dans son espace.
  if (p.consultantId && p.actor.role !== "REVENDEUR") {
    const user = await prisma.user.findFirst({ where: { consultantId: p.consultantId }, select: { id: true } });
    if (user) await prisma.notification.create({ data: { userId: user.id, title: "Produit remplacé dans une commande", message: `Commande ${short} : ${what}.`, orderId: p.orderId } }).catch(() => {});
  }
  const by = p.actor.role === "CLIENT" ? "le client" : p.actor.role === "REVENDEUR" ? `le revendeur ${p.actor.name ?? ""}`.trim() : `l'admin ${p.actor.name ?? ""}`.trim();
  const diff = p.change.difference;
  notifyTeamWhatsApp(`🔁 Commande ${short} modifiée par ${by} : ${what}. Écart : ${diff > 0 ? "+" : ""}${formatPrice(diff)}${p.avoir ? ` · avoir client ${formatPrice(p.avoir)}` : ""}${p.toPay && !p.isReservation ? ` · complément ${formatPrice(p.toPay)}` : ""}.`);
}
