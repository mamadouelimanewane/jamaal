"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { setOrderStatus } from "@/lib/orders/status";
import { takeOrderStock } from "@/lib/stock";
import { runPayoutsForOrder } from "@/lib/payouts/engine";
import { notifyOrderUpdate } from "@/lib/whatsapp/order-notify";

type R = { ok: boolean; message?: string; error?: string };
const ref = (id: string) => id.slice(-8).toUpperCase();
function refresh(id: string) {
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${id}`);
  revalidatePath("/admin/stocks");
}

/** Liste des commandes : confirmer une commande en attente (le stock ne bouge qu'au paiement). */
export async function quickConfirmOrder(id: string): Promise<R> {
  const session = await requireAdmin("commandes");
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!o) return { ok: false, error: "Commande introuvable." };
  if (o.status !== "EN_ATTENTE") return { ok: false, error: "Déjà traitée." };
  await setOrderStatus(id, "CONFIRMEE");
  await logActivity(session, `Commande confirmée ${ref(id)}`, "Order", id);
  refresh(id);
  return { ok: true, message: "Confirmée" };
}

/** Liste des commandes : annuler (stock remis seulement s'il avait été prélevé ; commissions annulées). */
export async function quickCancelOrder(id: string): Promise<R> {
  const session = await requireAdmin("commandes");
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true, paymentStatus: true, installmentsPaid: true, depositPaidAt: true } });
  if (!o) return { ok: false, error: "Commande introuvable." };
  if (o.status === "ANNULEE") return { ok: false, error: "Déjà annulée." };
  if (o.status === "LIVREE") return { ok: false, error: "Commande livrée : passez par un retour." };
  await setOrderStatus(id, "ANNULEE");
  await logActivity(session, `Commande annulée ${ref(id)}`, "Order", id);
  refresh(id);
  const paid = o.paymentStatus === "PAYE" || o.installmentsPaid > 0 || !!o.depositPaidAt;
  return { ok: true, message: paid ? "Annulée · déjà payée : remboursement à faire (Comptabilité › Trésorerie)" : "Annulée" };
}

/**
 * Liste des commandes : paiement reçu hors paiement en ligne (espèces, virement Wave ou Orange Money sur le
 * numéro de la boutique…). Les articles sortent du stock, les commissions sont créditées, la livraison démarre.
 */
export async function quickMarkPaid(id: string): Promise<R> {
  const session = await requireAdmin("commandes");
  const o = await prisma.order.findUnique({ where: { id }, select: { status: true, paymentStatus: true, installmentCount: true, isReservation: true, deliveryMode: true, deliveryStatus: true } });
  if (!o) return { ok: false, error: "Commande introuvable." };
  if (o.paymentStatus === "PAYE") return { ok: false, error: "Déjà payée." };
  if (o.status === "ANNULEE") return { ok: false, error: "Commande annulée." };
  if (o.installmentCount >= 2 || o.isReservation) return { ok: false, error: "Paiement en plusieurs fois ou réservation : réglez depuis la fiche de la commande." };
  const res = await prisma.order.updateMany({
    where: { id, paymentStatus: { not: "PAYE" } },
    data: { paymentStatus: "PAYE", paidAt: new Date(), paymentRef: `manuel:${session.user?.id ?? "admin"}`, ...(o.status === "EN_ATTENTE" ? { status: "CONFIRMEE" } : {}) },
  });
  if (!res.count) return { ok: false, error: "Déjà payée." };
  if (o.deliveryMode === "LIVRAISON_JAMAAL" && !o.deliveryStatus) {
    await prisma.order.update({ where: { id }, data: { deliveryStatus: "A_PREPARER", deliveryEvents: { create: { status: "A_PREPARER", note: "Paiement reçu : livraison à préparer" } } } });
  }
  await takeOrderStock(id, session.user?.id ?? null);
  after(() => runPayoutsForOrder(id));
  notifyOrderUpdate(id, "PAYEE");
  await logActivity(session, `Paiement reçu (manuel) · commande ${ref(id)}`, "Order", id);
  refresh(id);
  return { ok: true, message: "Payée · stock et commissions à jour" };
}
