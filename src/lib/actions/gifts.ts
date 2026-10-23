"use server";

import { cookies, headers } from "next/headers";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { getBusinessModel } from "@/lib/business-model-store";
import { getAvailablePaymentProviders, getPaymentProvider, type PaymentProviderId } from "@/lib/payment";
import { getSiteUrl } from "@/lib/site-url";
import { cleanPhone, GIFT_PREFIX, isOwnVoiceUrl, occasionOf, validGiftAmount } from "@/lib/gift/gift";
import { uniqueGiftCode } from "@/lib/gift/cards";

const AUDIO = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/aac", "audio/x-m4a", "audio/wav"];

/** Message vocal d'un cadeau (1 minute environ, 2 Mo au plus) : renvoie son adresse. */
export async function uploadGiftVoice(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = fd.get("voice");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Aucun enregistrement." };
  const type = file.type.split(";")[0];
  if (!AUDIO.includes(type) || file.size > 2 * 1024 * 1024) return { ok: false, error: "Message vocal trop long ou illisible (1 minute au plus)." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Le message vocal n'est pas encore disponible : écrivez votre message." };
  const limited = await rateLimit(`gift-voice:${clientIpFromHeaders(await headers())}`, { limit: 10, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Trop d'enregistrements : réessayez plus tard." };
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("mpeg") ? "mp3" : type.includes("wav") ? "wav" : "webm";
  const blob = await put(`cadeaux/voix-${Date.now()}.${ext}`, Buffer.from(await file.arrayBuffer()), { access: "public", addRandomSuffix: true, contentType: type });
  return { ok: true, url: blob.url };
}

export type GiftCardState = { ok: boolean; error?: string; redirectUrl?: string };

/** Achat d'une carte cadeau : enregistrée « en attente », puis paiement en ligne (Wave, Orange Money, carte bancaire). */
export async function buyGiftCard(input: Record<string, unknown>): Promise<GiftCardState> {
  const amount = validGiftAmount(input.amount);
  if (!amount) return { ok: false, error: "Montant entre 5 000 et 500 000 FCFA." };
  const buyerName = String(input.buyerName ?? "").trim().slice(0, 80);
  const recipientName = String(input.recipientName ?? "").trim().slice(0, 80);
  if (buyerName.length < 2) return { ok: false, error: "Indiquez votre nom (il apparaît sur la carte)." };
  if (recipientName.length < 2) return { ok: false, error: "Indiquez le prénom de la personne qui reçoit." };
  const recipientPhone = cleanPhone(input.recipientPhone);
  if (!recipientPhone) return { ok: false, error: "Numéro WhatsApp du destinataire invalide." };
  const buyerPhone = input.buyerPhone ? cleanPhone(input.buyerPhone) : null;
  if (input.buyerPhone && String(input.buyerPhone).trim() && !buyerPhone) return { ok: false, error: "Votre numéro WhatsApp est invalide." };
  const buyerEmail = String(input.buyerEmail ?? "").trim().slice(0, 120);
  if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return { ok: false, error: "Adresse e-mail invalide." };
  const voice = String(input.voiceUrl ?? "");
  const voiceUrl = voice && isOwnVoiceUrl(voice) ? voice : null;
  const method = String(input.method ?? "wave") as PaymentProviderId;
  if (!["wave", "orange_money", "stripe"].includes(method)) return { ok: false, error: "Choisissez un moyen de paiement." };

  const limited = await rateLimit(`gift:${clientIpFromHeaders(await headers())}`, { limit: 6, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Trop de tentatives : réessayez dans une heure." };

  const provider = getPaymentProvider(method);
  const offered = getAvailablePaymentProviders(await getBusinessModel()).some((p) => p.id === method);
  if (!provider || !provider.available || !offered) return { ok: false, error: "Ce moyen de paiement n'est pas ouvert pour le moment : choisissez-en un autre." };

  const refSlug = (String(input.ref ?? "") || (await cookies()).get("jamaal_ref")?.value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  const consultant = refSlug ? await prisma.consultant.findFirst({ where: { slug: refSlug, active: true }, select: { id: true } }) : null;

  const card = await prisma.giftCard.create({
    data: {
      code: await uniqueGiftCode(),
      amount,
      balance: 0,
      buyerName,
      buyerPhone,
      buyerEmail: buyerEmail || null,
      recipientName,
      recipientPhone,
      occasion: occasionOf(input.occasion)?.id ?? null,
      message: String(input.message ?? "").trim().slice(0, 300) || null,
      voiceUrl,
      consultantId: consultant?.id ?? null,
      paymentMethod: method === "wave" ? "WAVE" : method === "orange_money" ? "ORANGE_MONEY" : "STRIPE",
    },
  });
  try {
    const base = (await getSiteUrl()).replace(/\/$/, "");
    const res = await provider.createPayment({
      orderId: `${GIFT_PREFIX}${card.id}`,
      amount,
      customerName: buyerName,
      customerPhone: buyerPhone,
      customerEmail: buyerEmail || null,
      successUrl: `${base}/carte-cadeau/merci?c=${card.id}`,
      cancelUrl: `${base}/carte-cadeau?annule=1`,
      description: `Carte cadeau JAMAAL ${amount.toLocaleString("fr-FR")} FCFA`,
    });
    if (res.externalRef) await prisma.giftCard.update({ where: { id: card.id }, data: { paymentRef: res.externalRef } });
    if (res.redirect && res.url) return { ok: true, redirectUrl: res.url };
    return { ok: false, error: "Le paiement n'a pas pu démarrer, réessayez." };
  } catch (e) {
    console.error("[carte-cadeau] paiement", e);
    await prisma.giftCard.update({ where: { id: card.id }, data: { status: "ANNULEE" } }).catch(() => {});
    return { ok: false, error: e instanceof Error ? e.message : "Le paiement n'a pas pu démarrer, réessayez." };
  }
}

/** Admin : renvoyer la carte, la marquer payée (paiement reçu hors ligne) ou l'annuler. */
export async function adminGiftCardAction(id: string, action: "resend" | "markPaid" | "cancel"): Promise<{ ok: boolean; message?: string; error?: string }> {
  const { requireAdmin } = await import("./auth-guard");
  const { logActivity } = await import("@/lib/activity-log");
  const { revalidatePath } = await import("next/cache");
  const session = await requireAdmin("commandes");
  const card = await prisma.giftCard.findUnique({ where: { id }, select: { status: true } });
  if (!card) return { ok: false, error: "Carte introuvable." };
  let res: { ok: boolean; message?: string; error?: string };
  if (action === "markPaid") {
    if (card.status !== "EN_ATTENTE") return { ok: false, error: "Cette carte n'est plus en attente." };
    const { markGiftCardPaid } = await import("@/lib/gift/cards");
    res = (await markGiftCardPaid(id, { externalRef: "validée par l'admin" })) ? { ok: true, message: "Carte activée et envoyée." } : { ok: false, error: "Activation impossible." };
  } else if (action === "resend") {
    const { sendGiftCard } = await import("@/lib/gift/cards");
    res = (await sendGiftCard(id)) ? { ok: true, message: "Carte renvoyée sur WhatsApp." } : { ok: false, error: "Envoi impossible (WhatsApp ou carte non payée)." };
  } else {
    await prisma.giftCard.update({ where: { id }, data: { status: "ANNULEE" } });
    res = { ok: true, message: "Carte annulée." };
  }
  await logActivity(session, `Carte cadeau : ${action}`, "GiftCard", id);
  revalidatePath("/admin/abonnements");
  return res;
}
