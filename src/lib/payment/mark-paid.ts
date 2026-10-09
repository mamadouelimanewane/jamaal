import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runPayoutsForOrder } from "@/lib/payouts/engine";
import { prisma } from "@/lib/prisma";
import { awardLoyaltyForOrder } from "@/lib/loyalty-award";
import { amountDue } from "@/lib/reservation";

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
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;
  if (order.paymentStatus === "PAYE") return true;

  if (order.paymentMethod !== opts.method) {
    console.error("[payment] méthode inattendue", orderId, order.paymentMethod, opts.method);
    return false;
  }
  const due = amountDue(order);
  if (!due) return true; // rien à encaisser (réservation annulée ou soldée)
  if (opts.amount != null && opts.amount !== due.amount) {
    console.error("[payment] montant inattendu", orderId, opts.amount, due.amount);
    return false;
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
    },
  });
  if (res.count === 0) return true; // un autre appel concurrent a déjà traité

  try {
    await awardLoyaltyForOrder(orderId);
  } catch (err) {
    console.error("[loyalty] earn failed", err);
  }

  // Commissions du réseau : enregistrées et versées sur les wallets après la réponse au webhook.
  after(() => runPayoutsForOrder(orderId));

  revalidatePath(`/commande/${orderId}`);
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  return true;
}

/** Acompte de réservation reçu (paiement en ligne ou saisie de l'admin). Idempotent. */
export async function markDepositPaid(orderId: string, externalRef: string | null = null): Promise<boolean> {
  const res = await prisma.order.updateMany({
    where: { id: orderId, isReservation: true, depositPaidAt: null, reservationStatus: "ACOMPTE_ATTENDU" },
    data: { depositPaidAt: new Date(), reservationStatus: "RESERVEE", ...(externalRef ? { paymentRef: externalRef } : {}) },
  });
  if (res.count === 0) return false;
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
  revalidatePath(`/commande/${orderId}`);
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/commandes/${orderId}`);
  return true;
}
