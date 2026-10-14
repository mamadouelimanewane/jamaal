import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { canonicalizePhone, normalizePhone } from "@/lib/phone";
import { sendViaMeta, type RichOptions } from "./meta";
import { sendViaTwilio } from "./twilio";

/**
 * Envoi de messages WhatsApp (niveau 2). Le prestataire est choisi par WHATSAPP_PROVIDER
 * (« meta » = API Cloud de Meta / 360dialog, « twilio »). Sans configuration, les messages sont
 * SIMULÉS : ils sont enregistrés dans le journal mais rien n'est envoyé.
 */
export type WhatsAppKind = "team" | "reseller" | "test" | "client" | "bot" | "relance" | "avis" | "resume" | "suivi" | "livreur" | "kit" | "campagne" | "conseiller";

export interface SendResult {
  status: "SIMULE" | "ENVOYE" | "ECHEC";
  providerId?: string;
  error?: string;
}

export { normalizePhone };

export function whatsappConfig() {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  const metaReady = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const twilioReady = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  const active = provider === "meta" ? metaReady : provider === "twilio" ? twilioReady : false;
  return {
    provider: provider || "aucun",
    active,
    template: process.env.WHATSAPP_TEMPLATE_NAME ?? "",
    webhookReady: !!(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET),
  };
}

/**
 * Envoie (ou simule) un message et l'enregistre dans le journal. Ne lève jamais d'erreur.
 * Options riches (boutons, bouton lien, image) : rendues par Meta ; avec Twilio, le lien est
 * ajouté au texte. Le numéro est mis au format international (77… → 22177…).
 */
export async function sendWhatsApp(opts: { to: string; text: string; kind: WhatsAppKind; campaignId?: string } & RichOptions): Promise<SendResult> {
  const to = canonicalizePhone(opts.to);
  const body = opts.text.slice(0, 1500);
  const rich: RichOptions = { free: opts.free, template: opts.template, templateVars: opts.templateVars, buttons: opts.buttons, cta: opts.cta, imageUrl: opts.imageUrl };
  let result: SendResult;

  try {
    const cfg = whatsappConfig();
    if (!to || to.length < 8) result = { status: "ECHEC", error: "Numéro invalide" };
    else if (!cfg.active) result = { status: "SIMULE" };
    else if (cfg.provider === "meta") result = await sendViaMeta(to, body, rich);
    else result = await sendViaTwilio(to, opts.cta ? `${body}\n${opts.cta.label} : ${opts.cta.url}` : body);
  } catch (error) {
    result = { status: "ECHEC", error: error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue" };
  }

  // Le journal garde le texte tel que lu par le client (boutons et lien compris).
  const logged = [body, opts.buttons?.length ? `[${opts.buttons.join("] [")}]` : "", opts.cta ? `${opts.cta.label} : ${opts.cta.url}` : "", opts.imageUrl ? `[image] ${opts.imageUrl}` : ""].filter(Boolean).join("\n").slice(0, 2000);
  try {
    await prisma.whatsAppMessage.create({
      data: {
        direction: "OUT",
        toNumber: to || opts.to.slice(0, 30),
        kind: opts.kind,
        body: logged,
        status: result.status,
        providerId: result.providerId ?? null,
        error: result.error ?? null,
        campaignId: opts.campaignId ?? null,
      },
    });
    if (to) await touchThread(to);
  } catch (error) {
    console.error("[whatsapp] journal indisponible", error);
  }
  return result;
}

/** Met à jour la conversation de ce numéro (boîte de réception). */
export async function touchThread(phone: string, opts: { name?: string | null; inbound?: boolean } = {}) {
  const now = new Date();
  await prisma.whatsAppThread
    .upsert({
      where: { phone },
      create: { phone, name: opts.name ?? null, lastMessageAt: now },
      update: { lastMessageAt: now, ...(opts.name ? { name: opts.name } : {}) },
    })
    .catch(() => {});
}

/** Programme l'envoi APRÈS la réponse à l'utilisateur : une commande ou un formulaire ne ralentit jamais. */
function later(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}

/** Prévient l'équipe (Jamaal1 et Jamaal2). */
export function notifyTeamWhatsApp(text: string) {
  later(async () => {
    for (const c of WHATSAPP_CONTACTS) await sendWhatsApp({ to: c.number, text, kind: "team" });
  });
}

/** Prévient un consultant sur son WhatsApp (si son numéro est renseigné). */
export function notifyResellerWhatsApp(consultantId: string, text: string) {
  later(async () => {
    const c = await prisma.consultant.findUnique({ where: { id: consultantId }, select: { whatsapp: true, active: true } });
    if (c?.active && c.whatsapp) await sendWhatsApp({ to: c.whatsapp, text, kind: "reseller" });
  });
}
