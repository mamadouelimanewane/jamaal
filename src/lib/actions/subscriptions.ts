"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { addDays, validInterval } from "@/lib/subscriptions/plan";
import { createSubscriptionFromOrder, runSubscriptionOrder, setSubscriptionDiscountPct } from "@/lib/subscriptions/run";

export type SubState = { ok: boolean; message?: string; error?: string; token?: string };

/** Depuis la page de commande : « Recevoir automatiquement tous les X jours ». */
export async function subscribeFromOrder(orderId: string, intervalDays: number): Promise<SubState> {
  const limited = await rateLimit(`sub:${clientIpFromHeaders(await headers())}`, { limit: 6, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Trop de tentatives : réessayez plus tard." };
  try {
    const sub = await createSubscriptionFromOrder(String(orderId).slice(0, 40), intervalDays);
    revalidatePath(`/commande/${orderId}`);
    return { ok: true, token: sub.token, message: `C'est noté : vous recevrez ces produits tous les ${sub.intervalDays} jours, avec ${sub.discountPct} % de remise. Nous vous prévenons 3 jours avant.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Abonnement impossible pour le moment." };
  }
}

/** Gestion par le client (lien secret reçu sur WhatsApp). */
export async function manageSubscription(token: string, action: "pause" | "resume" | "cancel" | "interval" | "now" | "skip", value?: number): Promise<SubState> {
  const sub = await prisma.subscription.findUnique({ where: { token: String(token).slice(0, 60) } });
  if (!sub || sub.status === "ANNULE") return { ok: false, error: "Abonnement introuvable ou déjà arrêté." };
  const now = new Date();
  try {
    if (action === "pause") await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSE" } });
    else if (action === "resume") await prisma.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", nextRunAt: sub.nextRunAt < now ? addDays(now, 1) : sub.nextRunAt, remindedAt: null } });
    else if (action === "cancel") await prisma.subscription.update({ where: { id: sub.id }, data: { status: "ANNULE" } });
    else if (action === "interval") await prisma.subscription.update({ where: { id: sub.id }, data: { intervalDays: validInterval(value), nextRunAt: addDays(now, validInterval(value)), remindedAt: null } });
    else if (action === "skip") await prisma.subscription.update({ where: { id: sub.id }, data: { nextRunAt: addDays(sub.nextRunAt, sub.intervalDays), remindedAt: null } });
    else if (action === "now") {
      const limited = await rateLimit(`sub-now:${sub.id}`, { limit: 2, windowMs: 86_400_000 });
      if (!limited.ok) return { ok: false, error: "Une commande vient déjà d'être créée aujourd'hui." };
      const id = await runSubscriptionOrder(sub.id, now);
      revalidatePath(`/abonnement/${sub.token}`);
      return { ok: true, message: `Commande ${id.slice(-8).toUpperCase()} créée : le lien de paiement arrive sur WhatsApp.` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Modification impossible." };
  }
  revalidatePath(`/abonnement/${sub.token}`);
  return { ok: true, message: action === "cancel" ? "Abonnement arrêté." : action === "pause" ? "Abonnement en pause." : "C'est enregistré." };
}

export async function adminSubscriptionAction(id: string, action: "pause" | "resume" | "cancel" | "now"): Promise<SubState> {
  const session = await requireAdmin("commandes");
  const sub = await prisma.subscription.findUnique({ where: { id }, select: { token: true } });
  if (!sub) return { ok: false, error: "Abonnement introuvable." };
  const res = await manageSubscription(sub.token, action);
  await logActivity(session, `Abonnement : ${action}`, "Subscription", id);
  revalidatePath("/admin/abonnements");
  return res;
}

export async function saveSubscriptionDiscount(fd: FormData): Promise<void> {
  const session = await requireAdmin("commandes");
  await setSubscriptionDiscountPct(Number(fd.get("pct")));
  await logActivity(session, "Remise abonné modifiée", "Setting", "abonnement_remise_pct");
  revalidatePath("/admin/abonnements");
}
