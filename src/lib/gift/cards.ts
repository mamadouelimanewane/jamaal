/**
 * Cartes cadeaux (serveur) : paiement (référence gift_<id>), activation, envoi au destinataire sur WhatsApp.
 * Hors fichier "use server" : l'activation n'est appelable que depuis les webhooks et la vérification de paiement.
 */
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { sendWhatsApp, notifyTeamWhatsApp } from "@/lib/whatsapp";
import { messageText } from "@/lib/whatsapp/message-templates";
import { addDays } from "@/lib/subscriptions/plan";
import { GIFT_PREFIX, GIFT_VALIDITY_DAYS, newGiftCode, occasionPhrase } from "./gift";

const firstName = (s: string) => s.trim().split(/\s+/)[0] || s;
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Code unique (quelques essais en cas de collision). */
export async function uniqueGiftCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = newGiftCode();
    if (!(await prisma.giftCard.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Code indisponible, réessayez.");
}

/** Paiement reçu : la carte devient utilisable puis part chez le destinataire. Idempotent. */
export async function markGiftCardPaid(id: string, opts: { externalRef?: string; amount?: number } = {}): Promise<boolean> {
  const card = await prisma.giftCard.findUnique({ where: { id } });
  if (!card) return false;
  if (card.status !== "EN_ATTENTE") return true;
  if (opts.amount != null && opts.amount !== card.amount) {
    console.error("[carte-cadeau] montant inattendu", id, opts.amount, card.amount);
    return false;
  }
  const now = new Date();
  const res = await prisma.giftCard.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: { status: "ACTIVE", balance: card.amount, paidAt: now, expiresAt: addDays(now, GIFT_VALIDITY_DAYS), ...(opts.externalRef ? { paymentRef: opts.externalRef } : {}) },
  });
  if (!res.count) return true;
  await sendGiftCard(id).catch((e) => console.error("[carte-cadeau] envoi", e));
  notifyTeamWhatsApp(`🎁 Carte cadeau payée : ${fcfa(card.amount)} de ${card.buyerName} pour ${card.recipientName} (${card.recipientPhone}).`);
  return true;
}

/** Envoie (ou renvoie) la carte au destinataire, et la confirmation à l'acheteur. */
export async function sendGiftCard(id: string): Promise<boolean> {
  const card = await prisma.giftCard.findUnique({ where: { id } });
  if (!card || card.status === "EN_ATTENTE" || card.status === "ANNULEE") return false;
  const base = (await getSiteUrl()).replace(/\/$/, "");
  const lien = `${base}/carte-cadeau/${card.code}`;
  const vars = {
    prenom: firstName(card.recipientName),
    expediteur: card.buyerName,
    montant: fcfa(card.amount),
    occasion: occasionPhrase(card.occasion),
    message: card.message ? `« ${card.message} »` : "",
    code: card.code,
    lien,
  };
  const original = `🎁 Bonjour ${vars.prenom}, ${vars.expediteur} vous offre une carte cadeau JAMAAL de ${vars.montant}${vars.occasion} !${vars.message ? `\n${vars.message}` : ""}${card.voiceUrl ? "\n🎙️ Un message vocal vous attend sur la carte." : ""}\nVotre code : *${card.code}*. Choisissez vos parfums et soins, livrés chez vous : ${lien}`;
  const sent = await sendWhatsApp({ to: card.recipientPhone, text: await messageText("carte_cadeau", vars, original), kind: "client", cta: { label: "Voir ma carte cadeau", url: lien } });
  if (sent.status !== "ECHEC") await prisma.giftCard.update({ where: { id }, data: { sentAt: new Date() } });
  if (card.buyerPhone) {
    const bv = { prenom: firstName(card.buyerName), destinataire: firstName(card.recipientName), montant: fcfa(card.amount), code: card.code };
    const bo = `Merci ${bv.prenom} ! Votre carte cadeau de ${bv.montant} (code ${bv.code}) vient d'être envoyée à ${bv.destinataire} sur WhatsApp. 🎁`;
    await sendWhatsApp({ to: card.buyerPhone, text: await messageText("carte_cadeau_acheteur", bv, bo), kind: "client" });
  }
  return sent.status !== "ECHEC";
}

export const isGiftRef = (id: string) => id.startsWith(GIFT_PREFIX);
export const giftIdOf = (id: string) => id.slice(GIFT_PREFIX.length);
export { GIFT_PREFIX };
