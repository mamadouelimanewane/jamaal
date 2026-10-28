"use server";

import { payoutChannels } from "@/lib/business-model";
import { getBusinessModel } from "@/lib/business-model-store";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { advanceDelivery, DeliveryError, payLivreurs } from "@/lib/delivery-engine";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";
import { normalizeWalletNumber } from "@/lib/payouts/providers";
import { headers } from "next/headers";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { canonicalizePhone } from "@/lib/phone";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";

export type DeliveryActionResult = { ok: boolean; error?: string };

/** Le client peut proposer un nouveau créneau; la demande est journalisée et reste à confirmer par l'équipe. */
export async function requestDeliveryReschedule(orderId: string, phoneSuffix: string, requestedAt: string): Promise<DeliveryActionResult> {
  const limited = await rateLimit(`delivery-reschedule:${clientIpFromHeaders(await headers())}`, { limit: 4, windowMs: 60 * 60_000 });
  if (!limited.ok) return { ok: false, error: "Trop de demandes. Réessayez dans un moment." };
  if (!/^[a-z0-9_-]{12,64}$/i.test(orderId) || !/^\d{4}$/.test(phoneSuffix)) return { ok: false, error: "Vérifiez les informations saisies." };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, deliveryStatus: true, deliveryMode: true, customerName: true, customerPhone: true, deliveryContactPhone: true } });
  if (!order || order.deliveryMode !== "LIVRAISON_JAMAAL" || order.status === "ANNULEE" || order.deliveryStatus === "LIVREE") return { ok: false, error: "Cette livraison ne peut plus être reprogrammée." };
  const phone = canonicalizePhone(order.deliveryContactPhone ?? order.customerPhone ?? "");
  if (phone.length < 4 || phone.slice(-4) !== phoneSuffix) return { ok: false, error: "Les quatre derniers chiffres ne correspondent pas au numéro de la commande." };
  const date = new Date(requestedAt);
  if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 60 * 60_000 || date.getTime() > Date.now() + 14 * 86_400_000) return { ok: false, error: "Choisissez un créneau entre une heure et quatorze jours à partir de maintenant." };
  const slot = date.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Dakar" });
  await prisma.deliveryEvent.create({ data: { orderId, status: "DEMANDE_REPROGRAMMATION", note: `Demande client : ${slot}` } });
  notifyTeamWhatsApp(`Demande de nouveau créneau de livraison JAMAAL\nCommande ${orderId.slice(-8).toUpperCase()} · ${order.customerName}\nCréneau souhaité : ${slot}\nÀ confirmer avec le client.`);
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath(`/suivi/${orderId}`);
  return { ok: true };
}

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
  const livreur = await prisma.livreur.findFirst({ where: { id: livreurId, active: true }, select: { id: true, name: true } });
  if (!livreur) return { ok: false, error: "Livreur introuvable ou inactif." };
  try {
    await advanceDelivery(orderId, "ASSIGNEE", { kind: "admin" }, { livreurId: livreur.id, note: `Attribuée à ${livreur.name}` });
    await logActivity(session, `Livraison attribuée à ${livreur.name}`, "Order", orderId);
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
