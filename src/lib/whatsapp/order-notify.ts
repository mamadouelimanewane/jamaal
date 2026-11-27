/**
 * Suivi de commande sur WhatsApp (complément du site, jamais un remplacement) : à chaque étape
 * importante, le client reçoit un message court avec un bouton vers la page de la commande.
 * Respecte l'interrupteur « Suivi de commande » et le STOP du client. Ne lève jamais d'erreur.
 */
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { automationEnabled } from "@/lib/automation-settings";
import { phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp } from "./index";
import { messageText, type MessageKey } from "./message-templates";
import { META_AUTO_TEMPLATES, cleanTemplateVar } from "./auto-templates";

export type OrderEvent = "CREEE" | "PAYEE" | "ACOMPTE" | "CONFIRMEE" | "EXPEDIEE" | "ANNULEE" | "LIVREE";

const ref = (id: string) => id.slice(-8).toUpperCase();
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Texte et bouton du message (pur, testé). */
export function orderMessage(
  event: OrderEvent,
  o: { id: string; customerName: string; total: number; paymentStatus: string; channel: string; deliveryMode: string; isReservation?: boolean; depositAmount?: number; reservationDelay?: string | null; cancelPolicy?: string | null },
  site: string
): { text: string; cta?: { label: string; url: string } } | null {
  const first = o.customerName.split(/\s+/)[0] || o.customerName;
  const pay = { label: "Payer ma commande", url: `${site}/commande/${o.id}` };
  const track = { label: "Suivre ma commande", url: `${site}/suivi/${o.id}` };
  switch (event) {
    case "CREEE":
      // Une commande prise par l'assistant WhatsApp a déjà son récapitulatif dans la conversation.
      if (o.channel === "WHATSAPP") return null;
      if (o.isReservation) {
        const deposit = o.depositAmount ?? 0;
        return {
          // Produit en rupture : délai, argent conservé jusqu'à l'arrivée et conditions d'annulation, dès la réservation.
          text: `Bonjour ${first}, votre réservation JAMAAL n° ${ref(o.id)} est enregistrée${o.reservationDelay ? ` : produit commandé, délai ${o.reservationDelay}` : ""}. Réglez l'acompte de ${fcfa(deposit)} pour la confirmer (reste ${fcfa(Math.max(0, o.total - deposit))} à l'arrivée). Votre argent est conservé, bloqué jusqu'à l'arrivée du produit.${o.cancelPolicy ? ` Conditions : ${o.cancelPolicy}.` : ""}`,
          cta: pay,
        };
      }
      return {
        text: `Bonjour ${first}, merci pour votre commande JAMAAL n° ${ref(o.id)} (${fcfa(o.total)}).${o.paymentStatus === "PAYE" ? " Paiement bien reçu." : " Vous pouvez la payer par Wave ou Orange Money depuis votre page de commande."}\nRépondez à ce message pour toute question.`,
        cta: o.paymentStatus === "PAYE" ? track : pay,
      };
    case "ACOMPTE": {
      // Réservation : l'acompte est reçu, la commande est confirmée ; on rappelle le montant versé et le reste à payer.
      const deposit = o.depositAmount ?? 0;
      return {
        text: `Acompte reçu ✅ Merci ${first} ! Réservation JAMAAL n° ${ref(o.id)} confirmée : ${fcfa(deposit)} versés, conservés jusqu'à l'arrivée du produit. Reste ${fcfa(Math.max(0, o.total - deposit))} à l'arrivée.${o.reservationDelay ? ` Délai annoncé : ${o.reservationDelay}.` : ""}${o.cancelPolicy ? ` Conditions : ${o.cancelPolicy}.` : ""} Nous vous prévenons dès l'arrivée.`,
        cta: track,
      };
    }
    case "PAYEE":
      return { text: `Paiement reçu ✅ Merci ${first} ! Votre commande n° ${ref(o.id)} (${fcfa(o.total)}) est en préparation.`, cta: track };
    case "CONFIRMEE":
      return { text: `Bonne nouvelle ${first} : votre commande n° ${ref(o.id)} est confirmée et en préparation.`, cta: track };
    case "EXPEDIEE":
      return { text: `Votre commande JAMAAL n° ${ref(o.id)} est expédiée ${o.deliveryMode === "LIVRAISON_JAMAAL" ? "et arrive bientôt" : "chez votre revendeur, qui vous la remettra"}.`, cta: track };
    case "ANNULEE":
      return { text: `Votre commande JAMAAL n° ${ref(o.id)} a été annulée. Si c'est une erreur ou pour en repasser une, répondez simplement à ce message.` };
    case "LIVREE":
      // Les livraisons JAMAAL ont déjà leur message de fin (moteur de livraison).
      if (o.deliveryMode === "LIVRAISON_JAMAAL") return null;
      return { text: `Votre commande JAMAAL n° ${ref(o.id)} vous a été remise. Merci ${first}, et à très vite !` };
  }
}

/** Message modifiable (Admin › Journal WhatsApp) et ses variables, pour un évènement. Pur, testé. */
export function orderMessageVars(
  event: OrderEvent,
  o: { id: string; customerName: string; total: number; paymentStatus: string; deliveryMode: string; isReservation?: boolean; depositAmount?: number; reservationDelay?: string | null; cancelPolicy?: string | null }
): { key: MessageKey; vars: Record<string, string> } {
  const prenom = o.customerName.split(/\s+/)[0] || o.customerName;
  const deposit = o.depositAmount ?? 0;
  const base = { prenom, numero: ref(o.id), montant: fcfa(o.total) };
  switch (event) {
    case "CREEE":
      return o.isReservation
        ? { key: "suivi_reservation", vars: { ...base, acompte: fcfa(deposit), reste: fcfa(Math.max(0, o.total - deposit)), delai: o.reservationDelay ? ` : produit commandé, délai ${o.reservationDelay}` : "", conditions: o.cancelPolicy ? ` Conditions : ${o.cancelPolicy}.` : "" } }
        : { key: "suivi_creee", vars: { ...base, paiement: o.paymentStatus === "PAYE" ? " Paiement bien reçu." : " Vous pouvez la payer par Wave ou Orange Money depuis votre page de commande." } };
    case "ACOMPTE":
      return { key: "suivi_acompte", vars: { ...base, acompte: fcfa(deposit), reste: fcfa(Math.max(0, o.total - deposit)), delai: o.reservationDelay ? ` Délai annoncé : ${o.reservationDelay}.` : "", conditions: o.cancelPolicy ? ` Conditions : ${o.cancelPolicy}.` : "" } };
    case "PAYEE":
      return { key: "suivi_payee", vars: base };
    case "CONFIRMEE":
      return { key: "suivi_confirmee", vars: base };
    case "EXPEDIEE":
      return { key: "suivi_expediee", vars: { ...base, livraison: o.deliveryMode === "LIVRAISON_JAMAAL" ? "et arrive bientôt" : "chez votre revendeur, qui vous la remettra" } };
    case "ANNULEE":
      return { key: "suivi_annulee", vars: base };
    case "LIVREE":
      return { key: "suivi_livree", vars: base };
  }
}

export async function sendOrderUpdate(orderId: string, event: OrderEvent): Promise<void> {
  try {
    if (!(await automationEnabled("orderTracking"))) return;
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerName: true, customerPhone: true, total: true, paymentStatus: true, channel: true, deliveryMode: true, deliveryTarget: true, isReservation: true, depositAmount: true, reservationDelay: true, subscriptionId: true, createdAt: true },
    });
    if (!o?.customerPhone || (await phoneOptedOut(o.customerPhone))) return;
    const site = await getSiteUrl().catch(() => process.env.NEXT_PUBLIC_SITE_URL ?? "");
    // Commande d'un abonnement de réassort : message dédié (remise abonné, gestion de l'abonnement).
    if (event === "CREEE" && o.subscriptionId) {
      const sub = await prisma.subscription.findUnique({ where: { id: o.subscriptionId }, select: { token: true, discountPct: true } });
      if (sub) {
        const vars = { prenom: o.customerName.split(/\s+/)[0] || o.customerName, numero: ref(o.id), montant: fcfa(o.total), remise: `${sub.discountPct} %`, lien: `${site}/abonnement/${sub.token}` };
        const original = `Bonjour ${vars.prenom}, votre réassort JAMAAL n° ${vars.numero} est prêt : ${vars.montant} (remise abonné ${vars.remise} incluse). Payez en un clic avec le bouton ci-dessous. Gérer mon abonnement : ${vars.lien}`;
        await sendWhatsApp({
          to: o.customerPhone,
          kind: "suivi",
          recipientName: o.customerName,
          text: await messageText("abonnement_commande", vars, original),
          cta: { label: o.paymentStatus === "PAYE" ? "Suivre ma commande" : "Payer en un clic", url: `${site}/${o.paymentStatus === "PAYE" ? "suivi" : "commande"}/${o.id}` },
          template: META_AUTO_TEMPLATES.SUIVI_COMMANDE,
          templateLanguage: "fr",
          templateVars: [
            cleanTemplateVar(vars.prenom, 60, "Client"),
            vars.numero,
            cleanTemplateVar(`Votre réassort est prêt : ${vars.montant} (remise abonné ${vars.remise} incluse)`, 240),
            `${site}/${o.paymentStatus === "PAYE" ? "suivi" : "commande"}/${o.id}`,
          ],
        });
        return;
      }
    }
    // Réservation : conditions d'annulation (gratuite pendant N h, ensuite X % retenus) dans le message.
    let cancelPolicy: string | null = null;
    if (o.isReservation && (event === "CREEE" || event === "ACOMPTE")) {
      const { getReservationSettings } = await import("@/lib/reservation-store");
      const { cancelPolicyText } = await import("@/lib/reservation");
      cancelPolicy = cancelPolicyText(await getReservationSettings());
    }
    const withPolicy = { ...o, cancelPolicy };
    const msg = orderMessage(event, withPolicy, site);
    if (!msg) return;
    const { key, vars } = orderMessageVars(event, withPolicy);
    const rendered = await messageText(key, vars, msg.text);
    const isPayEvent = event === "PAYEE" || event === "ACOMPTE";
    const trackingUrl = msg.cta?.url || `${site}/suivi/${o.id}`;
    await sendWhatsApp({
      to: o.customerPhone,
      kind: "suivi",
      recipientName: o.customerName,
      text: rendered,
      cta: msg.cta,
      template: isPayEvent ? META_AUTO_TEMPLATES.PAIEMENT_ECHEANCE : META_AUTO_TEMPLATES.SUIVI_COMMANDE,
      templateLanguage: "fr",
      templateVars: isPayEvent
        ? [
            cleanTemplateVar(vars.prenom, 60, "Client"),
            vars.numero,
            cleanTemplateVar(fcfa(o.total), 40),
            cleanTemplateVar(rendered, 240),
            trackingUrl,
          ]
        : [
            cleanTemplateVar(vars.prenom, 60, "Client"),
            vars.numero,
            cleanTemplateVar(rendered, 240),
            trackingUrl,
          ],
    });
  } catch (e) {
    console.error("[whatsapp] suivi commande", orderId, event, e);
  }
}

/** Envoi après la réponse (une commande ou un clic admin ne ralentit jamais). */
export function notifyOrderUpdate(orderId: string, event: OrderEvent) {
  try {
    after(() => sendOrderUpdate(orderId, event));
  } catch {
    void sendOrderUpdate(orderId, event);
  }
}
