/**
 * Changement de statut d'une commande et ses effets (commissions, part du livreur, stock,
 * notifications). Module serveur ordinaire : l'appelant vérifie les droits (admin du back-office,
 * livreur, ou admin reconnu sur WhatsApp).
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyConsultantOfDelivery } from "@/lib/notifications";
import { cancelCommissionsForOrder, runPayoutsForOrder } from "@/lib/payouts/engine";
import { recordLivreurEarning } from "@/lib/delivery-engine";
import { syncOrderStock } from "@/lib/stock";
import { notifyOrderUpdate } from "@/lib/whatsapp/order-notify";

function later(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}

/** Commissions du réseau : versées à la livraison (si choisi), annulées si la commande l'est. */
async function onOrderStatusChanged(id: string, status: OrderStatus) {
  if (status === "LIVREE") {
    // Livraison JAMAAL marquée livrée depuis la fiche commande : on clôt aussi l'étape de livraison.
    const closed = await prisma.order.updateMany({
      where: { id, deliveryMode: "LIVRAISON_JAMAAL", deliveryStatus: { not: "LIVREE" } },
      data: { deliveryStatus: "LIVREE", deliveredAt: new Date() },
    });
    if (closed.count) await prisma.deliveryEvent.create({ data: { orderId: id, status: "LIVREE", note: "Marquée livrée par l'équipe JAMAAL" } });
    later(async () => {
      await runPayoutsForOrder(id);
      await recordLivreurEarning(id).catch((e) => console.error("[livraison] part livreur", id, e));
    });
  }
  if (status === "ANNULEE") await cancelCommissionsForOrder(id);
  // Stock : remis à l'annulation, repris si la commande est réactivée (une seule fois).
  await syncOrderStock(id);
}

function refresh(id: string) {
  try {
    revalidatePath("/admin/stocks");
    revalidatePath("/admin/commandes");
    revalidatePath(`/admin/commandes/${id}`);
  } catch {
    // Hors requête (tâche de fond) : rien à rafraîchir.
  }
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const before = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  await prisma.order.update({ where: { id }, data: { status } });
  if (before && before.status !== status) await prisma.orderStatusHistory.create({ data: { orderId: id, status } }).catch(() => {});
  if (status === "LIVREE") await notifyConsultantOfDelivery(id);
  await onOrderStatusChanged(id, status);
  if (status !== "EN_ATTENTE" && before?.status !== status) notifyOrderUpdate(id, status);
  refresh(id);
}
