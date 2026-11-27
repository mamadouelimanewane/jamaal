/**
 * Annulation d'une réservation (produit en rupture commandé pour le client).
 * La somme payée (acompte) était conservée, bloquée jusqu'à l'arrivée du produit ; à l'annulation elle est rendue
 * tout de suite dans l'avoir du client :
 * - annulée par JAMAAL : tout est rendu ;
 * - annulée par le client : gratuit pendant le délai réglé (24 h par défaut) après la réservation, ensuite la pénalité
 *   réglée (10 % de la somme payée par défaut) est retenue. Le client en est informé à la réservation.
 * Fichier serveur.
 */
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { cancellationTerms } from "@/lib/reservation";
import { getReservationSettings } from "@/lib/reservation-store";
import { safeReverse } from "@/lib/goods-credit";
import { syncOrderStock } from "@/lib/stock";
import { creditAvoir, customerOfOrder, restoreAvoirForCancelledOrder } from "@/lib/customer-wallet";
import { notifyTeamWhatsApp, sendWhatsApp } from "@/lib/whatsapp";

export type CancelReservationResult = { ok: true; refund: number; penalty: number; message: string } | { ok: false; error: string };

/** Somme payée sur une réservation (acompte, ou totalité si elle a été soldée avant l'annulation). */
export function paidOnReservation(o: { depositPaidAt: Date | null; depositAmount: number; paymentStatus: string; total: number }): number {
  if (o.paymentStatus === "PAYE") return o.total;
  return o.depositPaidAt ? o.depositAmount : 0;
}

export async function cancelReservation(orderId: string, opts: { byCustomer: boolean; userId?: string | null }): Promise<CancelReservationResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, isReservation: true, reservationStatus: true, status: true, depositPaidAt: true, depositAmount: true, paymentStatus: true, total: true, createdAt: true, customerName: true, customerPhone: true, consultantId: true, items: { select: { productName: true, volumeLabel: true } } },
  });
  if (!order || !order.isReservation) return { ok: false, error: "Réservation introuvable." };
  if (order.status === "ANNULEE" || order.reservationStatus === "ANNULEE") return { ok: false, error: "Cette réservation est déjà annulée." };
  if (order.reservationStatus === "SOLDEE" || order.status === "EXPEDIEE" || order.status === "LIVREE") return { ok: false, error: "Le produit vous a déjà été remis ou expédié : contactez JAMAAL sur WhatsApp." };

  const settings = await getReservationSettings();
  const paid = paidOnReservation(order);
  const now = new Date();
  const terms = cancellationTerms(paid, order.createdAt, now, settings, opts.byCustomer);

  // Une seule annulation, même en cas de double clic.
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: { not: "ANNULEE" } },
    data: {
      status: "ANNULEE",
      reservationStatus: "ANNULEE",
      deliveryStatus: null,
      ...(paid > 0 ? { refundedAt: now, refundChannel: "AVOIR", refundPenalty: terms.penalty, avoirRefunded: terms.refund } : {}),
    },
  });
  if (!claimed.count) return { ok: false, error: "Cette réservation est déjà annulée." };
  await prisma.orderStatusHistory.create({ data: { orderId, status: "ANNULEE" } });
  await safeReverse(orderId);
  await syncOrderStock(orderId, opts.userId ?? null);
  await restoreAvoirForCancelledOrder(orderId).catch((e) => console.error("[réservation] avoir utilisé", orderId, e));

  const short = orderId.slice(-8).toUpperCase();
  const product = order.items[0] ? `${order.items[0].productName} (${order.items[0].volumeLabel})` : "produit";
  const who = opts.byCustomer ? "à votre demande" : "par JAMAAL";
  const penaltyNote = terms.penalty > 0 ? ` ${formatPrice(terms.penalty)} (${settings.penaltyPercent} % de la somme payée) sont retenus, l'annulation ayant eu lieu plus de ${settings.freeCancelHours} h après la réservation.` : "";

  if (terms.refund > 0) {
    const customer = await customerOfOrder(orderId);
    if (customer) {
      await creditAvoir({
        customerId: customer.id,
        amount: terms.refund,
        orderId,
        sourceId: `resa-annul:${orderId}`,
        note: `Réservation ${short} annulée${terms.penalty ? ` (pénalité ${formatPrice(terms.penalty)})` : ""}`,
        reason: `votre réservation ${short} (${product}) est annulée ${who}.${penaltyNote}`,
      });
    } else {
      notifyTeamWhatsApp(`⚠️ Réservation ${short} annulée : ${formatPrice(terms.refund)} à rendre à la main (client sans numéro).`);
    }
  } else if (order.customerPhone) {
    const first = order.customerName.split(/\s+/)[0] || order.customerName;
    await sendWhatsApp({ to: order.customerPhone, text: `Bonjour ${first}, votre réservation JAMAAL ${short} (${product}) est annulée ${who}.${penaltyNote}`, kind: "client" }).catch(() => {});
  }

  if (order.consultantId) {
    const user = await prisma.user.findFirst({ where: { consultantId: order.consultantId }, select: { id: true } });
    if (user) await prisma.notification.create({ data: { userId: user.id, title: "Réservation annulée", message: `Réservation ${short} (${product}) annulée ${opts.byCustomer ? "par le client" : "par JAMAAL"}.`, orderId } }).catch(() => {});
  }
  if (opts.byCustomer) notifyTeamWhatsApp(`❌ Réservation ${short} annulée par le client (${product}). Rendu dans son avoir : ${formatPrice(terms.refund)}${terms.penalty ? ` · pénalité retenue ${formatPrice(terms.penalty)}` : ""}.`);

  const message =
    paid === 0
      ? "Réservation annulée (rien n'avait été payé)."
      : `Réservation annulée. ${formatPrice(terms.refund)} rendus dans l'avoir du client${terms.penalty ? `, pénalité de ${formatPrice(terms.penalty)} retenue` : ""}.`;
  return { ok: true, refund: terms.refund, penalty: terms.penalty, message };
}
