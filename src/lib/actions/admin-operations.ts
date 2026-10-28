"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getSiteUrl } from "@/lib/site-url";
import { notifyTeamWhatsApp, sendWhatsApp } from "@/lib/whatsapp";

export async function setGroupDealAdminStatus(id: string, action: "SUSPENDRE" | "REPRENDRE" | "CLOTURER") {
  const session = await requireAdmin("commandes", "write");
  if (!/^[a-z0-9_-]{12,64}$/i.test(id)) return { ok: false, error: "Offre introuvable." };
  const deal = await prisma.groupDeal.findUnique({ where: { id }, select: { id: true, status: true, expiresAt: true } });
  if (!deal) return { ok: false, error: "Offre introuvable." };
  let status = "";
  if (action === "SUSPENDRE" && deal.status === "OPEN") status = "SUSPENDUE";
  if (action === "REPRENDRE" && deal.status === "SUSPENDUE" && deal.expiresAt > new Date()) status = "OPEN";
  if (action === "CLOTURER" && ["OPEN", "SUSPENDUE"].includes(deal.status)) status = "CLOTUREE";
  if (!status) return { ok: false, error: "Cette offre ne peut plus être modifiée dans son état actuel." };
  const changed = await prisma.groupDeal.updateMany({ where: { id, status: deal.status }, data: { status } });
  if (!changed.count) return { ok: false, error: "L’offre vient d’être modifiée. Actualisez la page avant de réessayer." };
  await logActivity(session, `Offre groupée ${action.toLowerCase()}`, "GroupDeal", id);
  revalidatePath("/admin/commandes/achats-groupes");
  revalidatePath(`/achat-groupe/${id}`);
  return { ok: true };
}

export async function resolveDeliveryReschedule(eventId: string, decision: "CONFIRMER" | "REFUSER", note: string) {
  const session = await requireAdmin("livraison", "write");
  if (!/^[a-z0-9_-]{12,64}$/i.test(eventId)) return { ok: false, error: "Demande introuvable." };
  const event = await prisma.deliveryEvent.findUnique({ where: { id: eventId }, select: { id: true, orderId: true, status: true, note: true } });
  if (!event || event.status !== "DEMANDE_REPROGRAMMATION") return { ok: false, error: "Cette demande a déjà été traitée ou n’existe plus." };
  const requested = event.note?.match(/Demande client\s*:\s*([^\n]+)/i)?.[1]?.trim();
  const safeNote = String(note ?? "").trim().slice(0, 240);
  if (decision === "REFUSER" && safeNote.length < 3) return { ok: false, error: "Indiquez brièvement le motif du refus." };
  const status = decision === "CONFIRMER" ? "REPROGRAMMATION_CONFIRMEE" : "REPROGRAMMATION_REFUSEE";
  const adminNote = decision === "CONFIRMER"
    ? `Créneau de livraison confirmé par l’équipe${requested ? ` : ${requested}` : ""}${safeNote ? ` · ${safeNote}` : ""}`
    : `Demande de créneau refusée par l’équipe${safeNote ? ` : ${safeNote}` : ""}`;
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryEvent.updateMany({ where: { id: event.id, status: "DEMANDE_REPROGRAMMATION" }, data: { status: "DEMANDE_REPROGRAMMATION_TRAITEE", note: `${event.note ?? ""}\n${adminNote}`.trim() } });
      if (!updated.count) throw new Error("DEMANDE_DEJA_TRAITEE");
      await tx.deliveryEvent.create({ data: { orderId: event.orderId, status, note: adminNote } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DEMANDE_DEJA_TRAITEE") return { ok: false, error: "Cette demande vient d’être traitée par un autre membre de l’équipe." };
    throw error;
  }
  const order = await prisma.order.findUnique({ where: { id: event.orderId }, select: { customerName: true, customerPhone: true } });
  if (order?.customerPhone) {
    const origin = await getSiteUrl();
    const text = decision === "CONFIRMER"
      ? `Bonjour ${order.customerName}, Jamaal confirme votre demande de changement de créneau de livraison${requested ? ` pour ${requested}` : ""}.${safeNote ? ` ${safeNote}` : ""}`
      : `Bonjour ${order.customerName}, Jamaal ne peut pas confirmer le créneau demandé.${safeNote ? ` Motif : ${safeNote}` : ""} Contactez-nous pour convenir d’un autre créneau.`;
    await sendWhatsApp({ to: order.customerPhone, kind: "suivi", text, cta: { label: "Suivre ma commande", url: `${origin}/suivi/${event.orderId}` } });
  }
  if (decision === "CONFIRMER") notifyTeamWhatsApp(`Créneau de livraison accepté par l’équipe Jamaal · commande ${event.orderId.slice(-8).toUpperCase()} · ${requested ?? "voir la demande dans le suivi"}. Pensez à le prendre en compte dans la tournée.`);
  await logActivity(session, `Demande de reprogrammation ${decision.toLowerCase()}`, "DeliveryEvent", event.id);
  revalidatePath("/admin/livraisons/demandes-creneau");
  revalidatePath(`/suivi/${event.orderId}`);
  return { ok: true };
}
