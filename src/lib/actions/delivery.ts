"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { advanceDelivery, DeliveryError, payLivreurs } from "@/lib/delivery-engine";
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
  const session = await requireAdmin();
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
  const session = await requireAdmin();
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
  const session = await requireAdmin();
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
  const number = normalizeWalletNumber(raw);
  if (!number) return { ok: false, error: "Numéro invalide : indiquez un numéro mobile sénégalais (ex. 77 123 45 67)." };
  await prisma.livreur.update({ where: { id: livreur.id }, data: { walletProvider: provider, walletNumber: number } });
  revalidatePath("/admin/mes-livraisons");
  return { ok: true };
}
