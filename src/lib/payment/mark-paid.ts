import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runPayoutsForOrder } from "@/lib/payouts/engine";
import { notifyOrderUpdate } from "@/lib/whatsapp/order-notify";
import { prisma } from "@/lib/prisma";
import { awardLoyaltyForOrder } from "@/lib/loyalty-award";
import { amountDue } from "@/lib/reservation";
import { DEPOSIT_PREFIX, markDepositPaid as markWalletDepositPaid } from "@/lib/wallet";
import { GIFT_PREFIX } from "@/lib/gift/gift";
import { takeOrderStock } from "@/lib/stock";
import { dueDates, isInstallmentOrder } from "@/lib/installments";
import { notifyInstallmentReceived } from "@/lib/installments-notify";

type Method = "WAVE" | "ORANGE_MONEY" | "STRIPE";

/**
 * Marque une commande comme payée. Réservé au code serveur (webhooks) :
 * volontairement hors d'un fichier "use server" pour ne pas être appelable
 * depuis le navigateur.
 *
 * - Idempotent : la transition EN_ATTENTE → PAYE est atomique (updateMany),
 *   seul le premier appel crédite la fidélité.
 * - Vérifie que la commande a bien été initiée avec ce moyen de paiement et,
 *   si fourni, que le montant payé correspond au total.
 */
export async function markOrderPaid(
  orderId: string,
  opts: { method: Method; externalRef?: string; amount?: number }
): Promise<boolean> {
  // Dépôt sur un wallet de membre (référence wdep_<mouvement>).
  if (orderId.startsWith(DEPOSIT_PREFIX)) return markWalletDepositPaid(orderId.slice(DEPOSIT_PREFIX.length), { externalRef: opts.externalRef, amount: opts.amount });
  // Carte cadeau (référence gift_<carte>).
  if (orderId.startsWith(GIFT_PREFIX)) {
    const { markGiftCardPaid } = await import("@/lib/gift/cards");
    return markGiftCardPaid(orderId.slice(GIFT_PREFIX.length), { externalRef: opts.externalRef, amount: opts.amount });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;
  if (order.paymentStatus === "PAYE") return true;

  if (order.paymentMethod !== opts.method) {
    console.error("[payment] méthode inattendue", orderId, order.paymentMethod, opts.method);
    return false;
  }
  // Paiement en plusieurs fois : un même paiement (même référence) n'est jamais compté deux fois.
  if (isInstallmentOrder(order) && opts.externalRef && order.installmentRefs.includes(opts.externalRef)) return true;
  const due = amountDue(order);
  if (!due) return true; // rien à encaisser (réservation annulée ou soldée)
  if (opts.amount != null && opts.amount !== due.amount) {
    console.error("[payment] montant inattendu", orderId, opts.amount, due.amount);
    return false;
  }

  // Échéance intermédiaire : comptée (atomiquement), sans clôturer le paiement ni verser de commission.
  const lastInstallment = due.part === "ECHEANCE" && order.installmentsPaid + 1 >= order.installmentCount;
  if (due.part === "ECHEANCE" && !lastInstallment) {
    const k = order.installmentsPaid;
    const next = dueDates(order.createdAt, order.installmentCount, order.installmentIntervalDays)[k + 1];
    const res = await prisma.order.updateMany({
      where: { id: orderId, installmentsPaid: k, paymentStatus: { not: "PAYE" } },
      data: { installmentsPaid: k + 1, installmentNextDue: next, installmentPaidDates: { push: new Date() }, ...(opts.externalRef ? { installmentRefs: { push: opts.externalRef } } : {}), ...(order.status === "EN_ATTENTE" ? { status: "CONFIRMEE" } : {}) },
    });
    if (res.count) {
      // 1re échéance reçue : les produits sont mis de côté (sortie du stock).
      await takeOrderStock(orderId).catch((e) => console.error("[stock] échéance", orderId, e));
      try {
        after(() => notifyInstallmentReceived(orderId, k + 1));
      } catch {
        void notifyInstallmentReceived(orderId, k + 1);
      }
      safeRevalidate(`/commande/${orderId}`);
      safeRevalidate(`/admin/commandes/${orderId}`);
    }
    return true;
  }

  // Réservation : l'acompte réserve le produit, sans clôturer le paiement ni verser de commission.
  if (due.part === "ACOMPTE") {
    await markDepositPaid(orderId, opts.externalRef ?? null);
    return true;
  }

  const res = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAYE" } },
    data: {
      paymentStatus: "PAYE",
      paidAt: new Date(),
      ...(opts.externalRef ? { paymentRef: opts.externalRef } : {}),
      ...(order.status === "EN_ATTENTE" ? { status: "CONFIRMEE" } : {}),
      ...(order.isReservation ? { reservationStatus: "SOLDEE" } : {}),
      ...(lastInstallment ? { installmentsPaid: order.installmentCount, installmentNextDue: null, installmentPaidDates: { push: new Date() }, ...(opts.externalRef ? { installmentRefs: { push: opts.externalRef } } : {}) } : {}),
    },
  });
  if (res.count === 0) return true; // un autre appel concurrent a déjà traité

  // Paiement effectif : les articles sortent du stock maintenant (une seule fois).
  await takeOrderStock(orderId).catch((e) => console.error("[stock] paiement", orderId, e));

  // Lien de paiement d'un revendeur : la livraison part en préparation maintenant, et le revendeur est prévenu.
  if (order.channel === "REVENDEUR" || isInstallmentOrder(order)) {
    try {
      await afterPayLinkPaid(order);
    } catch (err) {
      console.error("[lien de paiement]", err);
    }
  }

  try {
    await awardLoyaltyForOrder(orderId);
  } catch (err) {
    console.error("[loyalty] earn failed", err);
  }

  // Commissions du réseau : enregistrées et versées sur les wallets après la réponse au webhook.
  after(() => runPayoutsForOrder(orderId));
  notifyOrderUpdate(orderId, "PAYEE");

  safeRevalidate(`/commande/${orderId}`);
  safeRevalidate("/admin/commandes");
  safeRevalidate(`/admin/commandes/${orderId}`);
  return true;
}

/** Acompte de réservation reçu (paiement en ligne ou saisie de l'admin). Idempotent. */
export async function markDepositPaid(orderId: string, externalRef: string | null = null): Promise<boolean> {
  const res = await prisma.order.updateMany({
    where: { id: orderId, isReservation: true, depositPaidAt: null, reservationStatus: "ACOMPTE_ATTENDU" },
    data: { depositPaidAt: new Date(), reservationStatus: "RESERVEE", ...(externalRef ? { paymentRef: externalRef } : {}) },
  });
  if (res.count === 0) return false;
  // Le client est prévenu tout de suite et automatiquement : commande confirmée, acompte versé, reste à payer.
  notifyOrderUpdate(orderId, "ACOMPTE");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerName: true, depositAmount: true, items: { select: { productName: true, volumeLabel: true, quantity: true } } } });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (order && admins.length) {
    const it = order.items[0];
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        orderId,
        title: "Acompte de réservation reçu",
        message: `${order.customerName} : ${order.depositAmount.toLocaleString("fr-FR")} FCFA pour ${it ? `${it.productName} (${it.volumeLabel} × ${it.quantity})` : "sa réservation"}. À commander chez Chogan.`,
      })),
    });
  }
  safeRevalidate(`/commande/${orderId}`);
  safeRevalidate("/admin/reservations");
  safeRevalidate(`/admin/commandes/${orderId}`);
  return true;
}


/** Commande d'un revendeur payée en ligne par son client : livraison à préparer, notification au revendeur. */
async function afterPayLinkPaid(order: { id: string; consultantId: string | null; deliveryMode: string; deliveryStatus: string | null; isReservation: boolean; customerName: string; total: number; installmentCount: number }) {
  if (order.deliveryMode === "LIVRAISON_JAMAAL" && !order.deliveryStatus && !order.isReservation) {
    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryStatus: "A_PREPARER", deliveryEvents: { create: { status: "A_PREPARER", note: "Paiement en ligne reçu : livraison à préparer" } } },
    });
    safeRevalidate("/admin/livraisons");
  }
  if (!order.consultantId) return;
  const user = await prisma.user.findFirst({ where: { consultantId: order.consultantId }, select: { id: true } });
  if (!user) return;
  await prisma.notification.create({
    data: {
      userId: user.id,
      orderId: order.id,
      title: isInstallmentOrder(order) ? "Commande entièrement payée 💳" : "Paiement reçu 💳",
      message: `${order.customerName} a réglé ${isInstallmentOrder(order) ? `la dernière échéance de sa commande (${order.total.toLocaleString("fr-FR")} F au total)` : `sa commande de ${order.total.toLocaleString("fr-FR")} F`} en ligne. Commande n° ${order.id.slice(-8).toUpperCase()}.`,
    },
  });
  safeRevalidate(`/admin/mes-commandes/${order.id}`);
}

/** revalidatePath est refusé pendant le rendu d'une page (vérification au retour du client) : sans conséquence ici. */
function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}
