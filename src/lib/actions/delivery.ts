"use server";

import { payoutChannels } from "@/lib/business-model";
import { getBusinessModel, saveBusinessModel } from "@/lib/business-model-store";
import { autoAssignPending } from "@/lib/delivery-dispatch";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireConsultantProfile, requireLivreurProfile } from "./auth-guard";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { advanceDelivery, DeliveryError, ensureJamaalDelivery, payLivreurs, sendDeliveryCode } from "@/lib/delivery-engine";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";
import { normalizeWalletNumber } from "@/lib/payouts/providers";

export type DeliveryActionResult = { ok: boolean; error?: string };

const STATUSES = Object.keys(DELIVERY_LABELS) as DeliveryStatus[];
const asStatus = (v: string): DeliveryStatus | null => (STATUSES.includes(v as DeliveryStatus) ? (v as DeliveryStatus) : null);

function failure(error: unknown): DeliveryActionResult {
  if (error instanceof DeliveryError) return { ok: false, error: error.message };
  console.error("[livraison]", error);
  return { ok: false, error: "Action impossible pour le moment, réessayez." };
}

/** Le livreur fait avancer sa livraison (avec sa position, et le code client pour « Livrée »). */
export async function livreurAdvanceDelivery(
  orderId: string,
  to: string,
  opts: { lat?: number | null; lng?: number | null; code?: string; note?: string } = {}
): Promise<DeliveryActionResult> {
  const { livreur } = await requireLivreurProfile();
  const status = asStatus(to);
  if (!status) return { ok: false, error: "Étape inconnue." };
  try {
    await advanceDelivery(orderId, status, { kind: "livreur", livreurId: livreur.id }, opts);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** L'admin attribue (ou réattribue) un livreur. */
export async function assignLivreurAction(orderId: string, livreurId: string): Promise<DeliveryActionResult> {
  const session = await requireAdmin("livraison");
  const livreur = await prisma.livreur.findFirst({ where: { id: livreurId, active: true }, select: { id: true, name: true, _count: { select: { documents: true } } } });
  if (!livreur) return { ok: false, error: "Livreur introuvable ou inactif." };
  if (!livreur._count.documents) return { ok: false, error: `Pièce d'identité de ${livreur.name} manquante : ajoutez-la dans Livreurs › Modifier avant de lui confier une course.` };
  try {
    // Toute commande peut être confiée à un livreur : elle devient une livraison JAMAAL.
    await ensureJamaalDelivery(orderId);
    await advanceDelivery(orderId, "ASSIGNEE", { kind: "admin" }, { livreurId: livreur.id, note: `Attribuée à ${livreur.name}` });
    await logActivity(session, `Livraison attribuée à ${livreur.name}`, "Order", orderId);
    revalidatePath("/admin/livraisons");
    revalidatePath(`/admin/commandes/${orderId}`);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** L'admin force une étape (ex. échec signalé par téléphone, livraison confirmée hors application). */
export async function adminSetDeliveryStatus(orderId: string, to: string, note?: string): Promise<DeliveryActionResult> {
  const session = await requireAdmin("livraison");
  const status = asStatus(to);
  if (!status) return { ok: false, error: "Étape inconnue." };
  try {
    await advanceDelivery(orderId, status, { kind: "admin" }, { note: note || (status === "ECHEC" ? "Signalé par l'équipe JAMAAL" : undefined) });
    await logActivity(session, `Livraison : ${DELIVERY_LABELS[status]}`, "Order", orderId);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Verse les parts « à verser » des livreurs sur leur wallet. */
export async function payLivreursAction(): Promise<DeliveryActionResult & { sent?: number }> {
  const session = await requireAdmin("livraison");
  const sent = await payLivreurs();
  await logActivity(session, `Versements livreurs (${sent})`, "LivreurEarning");
  revalidatePath("/admin/livraisons");
  return { ok: true, sent };
}

export type LivreurWalletState = { ok: boolean; error?: string };

/** Le livreur indique son wallet Wave / Orange Money. */
export async function updateLivreurWallet(_prev: LivreurWalletState, formData: FormData): Promise<LivreurWalletState> {
  const { livreur } = await requireLivreurProfile();
  const provider = String(formData.get("walletProvider") ?? "");
  const raw = String(formData.get("walletNumber") ?? "").trim();
  if (provider !== "WAVE" && provider !== "ORANGE_MONEY") return { ok: false, error: "Choisissez Wave ou Orange Money." };
  const allowed = payoutChannels(await getBusinessModel());
  if (!allowed.includes(provider)) return { ok: false, error: `Les retraits sont proposés vers ${allowed.map((c) => (c === "WAVE" ? "Wave" : "Orange Money")).join(" ou ")} uniquement.` };
  const number = normalizeWalletNumber(raw);
  if (!number) return { ok: false, error: "Numéro invalide : indiquez un numéro mobile sénégalais (ex. 77 123 45 67)." };
  await prisma.livreur.update({ where: { id: livreur.id }, data: { walletProvider: provider, walletNumber: number } });
  revalidatePath("/admin/mes-livraisons");
  return { ok: true };
}

export type CashState = { ok: boolean; error?: string; message?: string } | null;

/** L'admin enregistre les espèces reversées par un livreur (remet son wallet à niveau). */
export async function recordCashRemittance(livreurId: string, _prev: CashState, formData: FormData): Promise<CashState> {
  const session = await requireAdmin("livraison");
  const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(/\s/g, "")));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: "Montant invalide." };
  const l = await prisma.livreur.findUnique({ where: { id: livreurId }, select: { name: true } });
  if (!l) return { ok: false, error: "Livreur introuvable." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 120);
  await prisma.walletTransaction.create({ data: { ownerType: "LIVREUR", ownerId: livreurId, amount, kind: "REVERSEMENT", note: note || "Espèces reversées à JAMAAL", createdBy: session.user?.id ?? null } });
  await logActivity(session, `Espèces reçues de ${l.name} : ${amount} F`, "Livreur", livreurId);
  revalidatePath("/admin/livreurs");
  revalidatePath(`/admin/livreurs/${livreurId}/modifier`);
  return { ok: true, message: `${amount.toLocaleString("fr-FR")} F enregistrés.` };
}

/** Mode d'attribution des livraisons (page Livraisons) : manuel ou automatique, et maximum de courses par livreur. */
export async function setDeliveryDispatch(mode: "MANUEL" | "AUTO", maxActive?: number): Promise<DeliveryActionResult & { assigned?: number }> {
  const session = await requireAdmin("livraison");
  const model = await getBusinessModel();
  const next = { ...model, deliveryDispatch: mode === "AUTO" ? ("AUTO" as const) : ("MANUEL" as const), dispatchMaxActive: maxActive && maxActive >= 1 ? Math.min(50, Math.round(maxActive)) : model.dispatchMaxActive };
  await saveBusinessModel(next);
  await logActivity(session, `Attribution des livraisons : ${next.deliveryDispatch === "AUTO" ? `automatique (max ${next.dispatchMaxActive} par livreur)` : "manuelle"}`, "BusinessModel");
  const assigned = next.deliveryDispatch === "AUTO" ? await autoAssignPending() : 0;
  revalidatePath("/admin/livraisons");
  return { ok: true, assigned };
}

/** « Attribuer maintenant » : lance l'attribution automatique des livraisons en attente. */
export async function runAutoAssign(): Promise<DeliveryActionResult & { assigned?: number }> {
  await requireAdmin("livraison");
  const model = await getBusinessModel();
  if (model.deliveryDispatch !== "AUTO") return { ok: false, error: "Activez d'abord l'attribution automatique." };
  const assigned = await autoAssignPending();
  revalidatePath("/admin/livraisons");
  return { ok: true, assigned };
}

/**
 * (Ré)envoyer le code de livraison au destinataire du colis, par WhatsApp. Équipe (Livraisons) ou vendeur
 * de la commande. Renvoie aussi le texte, pour un envoi manuel si WhatsApp ne passe pas.
 */
export async function resendDeliveryCode(orderId: string): Promise<DeliveryActionResult & { status?: string; phone?: string | null; text?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "ADMIN") await requireAdmin("livraison");
  else if (role === "CONSULTANT") {
    const { consultant } = await requireConsultantProfile();
    const mine = await prisma.order.count({ where: { id: orderId, consultantId: consultant.id } });
    if (!mine) return { ok: false, error: "Commande introuvable." };
  } else return { ok: false, error: "Accès refusé." };
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { deliveryCode: true, deliveryStatus: true, status: true } });
  if (!o?.deliveryCode) return { ok: false, error: "Cette commande n'a pas de code de livraison (elle n'est pas en livraison JAMAAL)." };
  if (o.deliveryStatus === "LIVREE" || o.status === "ANNULEE") return { ok: false, error: "Commande déjà livrée ou annulée." };
  const r = await sendDeliveryCode(orderId, "RENVOI");
  if (session?.user?.id) await logActivity(session, `Code de livraison renvoyé (${r.status})`, "Order", orderId).catch(() => {});
  return { ok: true, status: r.status, phone: r.phone, text: r.text };
}
