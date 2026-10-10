"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { markDepositPaid } from "@/lib/payment/mark-paid";
import { moveStock, resolveStockRef, StockError, syncOrderStock } from "@/lib/stock";
import { arrivalMessage, normalizeReservation } from "@/lib/reservation";
import { getReservationSettings, saveReservationSettings } from "@/lib/reservation-store";
import { getSiteUrl } from "@/lib/site-url";
import { sendWhatsApp } from "@/lib/whatsapp";
import { formatPrice } from "@/lib/currency";

export type ReservationActionResult = { ok: boolean; message?: string; error?: string; whatsappUrl?: string };

const short = (id: string) => id.slice(-8).toUpperCase();

function refresh(orderId?: string) {
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/stocks");
  revalidatePath("/admin/livraisons");
  if (orderId) {
    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath(`/commande/${orderId}`);
  }
}

export async function saveReservationSettingsAction(_prev: ReservationActionResult, formData: FormData): Promise<ReservationActionResult> {
  const session = await requireAdmin();
  const pct = Number(formData.get("depositPercent"));
  if (!Number.isInteger(pct) || pct < 10 || pct > 100) return { ok: false, error: "L'acompte doit être compris entre 10 et 100 %." };
  const delay = String(formData.get("delayLabel") ?? "").trim();
  if (!delay) return { ok: false, error: "Indiquez le délai annoncé au client." };
  const s = normalizeReservation({ enabled: formData.get("enabled") === "on", depositPercent: pct, delayLabel: delay, refundable: formData.get("refundable") === "on" });
  await saveReservationSettings(s);
  await logActivity(session, `Réservations : ${s.enabled ? "actives" : "désactivées"}, acompte ${s.depositPercent} %, délai « ${s.delayLabel} »`, "Setting");
  refresh();
  revalidatePath("/produits/[slug]", "page");
  return { ok: true, message: "Réglages enregistrés." };
}

/** Acompte reçu hors paiement en ligne (Wave manuel, espèces…). */
export async function reservationDepositReceivedAction(orderId: string): Promise<ReservationActionResult> {
  const session = await requireAdmin();
  const done = await markDepositPaid(orderId, null);
  if (!done) return { ok: false, error: "Acompte déjà enregistré, ou réservation annulée." };
  await logActivity(session, `Acompte reçu · réservation ${short(orderId)}`, "Order", orderId);
  refresh(orderId);
  return { ok: true, message: "Acompte enregistré : la réservation est confirmée." };
}

/**
 * Le produit est arrivé : on le prend dans le stock pour ce client, la commande entre dans le
 * circuit normal (préparation, livraison) et le client est prévenu pour régler le solde.
 */
export async function reservationArrivedAction(orderId: string): Promise<ReservationActionResult> {
  const session = await requireAdmin();
  const userId = session.user?.id ?? null;
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { reservationStatus: true, deliveryMode: true, items: { select: { productId: true, variantId: true, volumeLabel: true, quantity: true } } } });
      if (!order || order.reservationStatus !== "RESERVEE") throw new StockError("la réservation n'attend pas d'arrivage (acompte non reçu, déjà servie ou annulée)");
      const claim = await tx.order.updateMany({
        where: { id: orderId, reservationStatus: "RESERVEE" },
        data: {
          reservationStatus: "DISPONIBLE",
          reservationReadyAt: new Date(),
          stockState: "RESERVE",
          status: "CONFIRMEE",
          ...(order.deliveryMode === "LIVRAISON_JAMAAL" ? { deliveryStatus: "A_PREPARER" } : {}),
        },
      });
      if (!claim.count) throw new StockError("réservation déjà traitée");
      for (const item of order.items) {
        if (!item.productId) continue;
        const ref = item.variantId ? { productId: item.productId, variantId: item.variantId, label: item.volumeLabel } : await resolveStockRef(tx, item.productId, item.volumeLabel);
        if (!ref) continue;
        await moveStock(tx, ref, -item.quantity, { kind: "VENTE", strict: true, orderId, userId, reason: `Réservation servie · ${short(orderId)}` });
      }
      await tx.orderStatusHistory.create({ data: { orderId, status: "CONFIRMEE" } });
      if (order.deliveryMode === "LIVRAISON_JAMAAL") await tx.deliveryEvent.create({ data: { orderId, status: "A_PREPARER", note: "Réservation : produit arrivé" } });
    });
  } catch (e) {
    const msg = e instanceof StockError ? e.message : "Opération impossible.";
    return { ok: false, error: /stock insuffisant|il manque|manquait/i.test(msg) ? `Stock insuffisant : réceptionnez d'abord la marchandise (${msg}).` : msg.replace(/^./, (c) => c.toUpperCase()) };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerName: true, customerPhone: true, deliveryContactPhone: true, total: true, depositAmount: true, deliveryMode: true, items: { select: { productName: true, volumeLabel: true } } } });
  let whatsappUrl: string | undefined;
  if (order) {
    const it = order.items[0];
    const msg = arrivalMessage(
      { id: orderId, customerName: order.customerName, customerPhone: order.customerPhone ?? order.deliveryContactPhone, total: order.total, depositAmount: order.depositAmount, deliveryMode: order.deliveryMode, product: it ? `${it.productName} (${it.volumeLabel})` : "produit" },
      await getSiteUrl(),
      formatPrice
    );
    const phone = order.customerPhone ?? order.deliveryContactPhone;
    if (phone) await sendWhatsApp({ to: phone, text: msg.text, kind: "client" });
    whatsappUrl = msg.url ?? undefined;
  }
  await logActivity(session, `Réservation servie · ${short(orderId)}`, "Order", orderId);
  refresh(orderId);
  return { ok: true, message: "Produit attribué au client : la commande passe en préparation, le client est prévenu.", whatsappUrl };
}

/** Annule une réservation ; remet le stock s'il avait été attribué. */
export async function reservationCancelAction(orderId: string): Promise<ReservationActionResult> {
  const session = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { reservationStatus: true, depositPaidAt: true, depositAmount: true, paymentStatus: true } });
  if (!order || !order.reservationStatus || ["ANNULEE", "SOLDEE"].includes(order.reservationStatus)) return { ok: false, error: "Cette réservation ne peut plus être annulée ici." };
  await prisma.order.update({ where: { id: orderId }, data: { status: "ANNULEE", reservationStatus: "ANNULEE", deliveryStatus: null } });
  await prisma.orderStatusHistory.create({ data: { orderId, status: "ANNULEE" } });
  await syncOrderStock(orderId, session.user?.id ?? null);
  await logActivity(session, `Réservation annulée · ${short(orderId)}`, "Order", orderId);
  refresh(orderId);
  const settings = await getReservationSettings();
  const beforeArrival = order.reservationStatus === "ACOMPTE_ATTENDU" || order.reservationStatus === "RESERVEE";
  const refund = !order.depositPaidAt
    ? ""
    : settings.refundable && beforeArrival
      ? ` Acompte de ${formatPrice(order.depositAmount)} à rembourser au client : notez-le dans Comptabilité › Trésorerie une fois fait.`
      : ` Acompte de ${formatPrice(order.depositAmount)} conservé (conditions de réservation).`;
  return { ok: true, message: `Réservation annulée.${refund}` };
}
