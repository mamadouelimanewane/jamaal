import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runPayoutsForOrder } from "@/lib/payouts/engine";
import { prisma } from "@/lib/prisma";
import { awardLoyaltyForOrder } from "@/lib/loyalty-award";

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
  if (opts.amount != null && opts.amount !== order.total) {
    console.error("[payment] montant inattendu", orderId, opts.amount, order.total);
    return false;
  }

  const res = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAYE" } },
    data: {
      paymentStatus: "PAYE",
      paidAt: new Date(),
      ...(opts.externalRef ? { paymentRef: opts.externalRef } : {}),
      ...(order.status === "EN_ATTENTE" ? { status: "CONFIRMEE" } : {}),
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
