import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { sendViaMeta } from "./meta";
import { sendViaTwilio } from "./twilio";

/**
 * Envoi de messages WhatsApp (niveau 2). Le prestataire est choisi par WHATSAPP_PROVIDER
 * (« meta » = API Cloud de Meta / 360dialog, « twilio »). Sans configuration, les messages sont
 * SIMULÉS : ils sont enregistrés dans le journal mais rien n'est envoyé.
 */
export type WhatsAppKind = "team" | "reseller" | "test" | "client";

export interface SendResult {
  status: "SIMULE" | "ENVOYE" | "ECHEC";
  providerId?: string;
  error?: string;
}

export const normalizePhone = (raw: string) => raw.replace(/\D/g, "").replace(/^00/, "");

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

/** Envoie (ou simule) un message et l'enregistre dans le journal. Ne lève jamais d'erreur. */
export async function sendWhatsApp(opts: { to: string; text: string; kind: WhatsAppKind }): Promise<SendResult> {
  const to = normalizePhone(opts.to);
  const body = opts.text.slice(0, 1500);
  let result: SendResult;

  try {
    const cfg = whatsappConfig();
    if (!to || to.length < 8) result = { status: "ECHEC", error: "Numéro invalide" };
    else if (!cfg.active) result = { status: "SIMULE" };
    else if (cfg.provider === "meta") result = await sendViaMeta(to, body);
    else result = await sendViaTwilio(to, body);
  } catch (error) {
    result = { status: "ECHEC", error: error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue" };
  }

  try {
    await prisma.whatsAppMessage.create({
      data: {
        direction: "OUT",
        toNumber: to || opts.to.slice(0, 30),
        kind: opts.kind,
        body,
        status: result.status,
        providerId: result.providerId ?? null,
        error: result.error ?? null,
      },
    });
  } catch (error) {
    console.error("[whatsapp] journal indisponible", error);
  }
  return result;
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
