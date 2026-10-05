import type { SendResult } from "./index";

const API = "https://graph.facebook.com/v21.0";

/**
 * API Cloud de Meta (aussi utilisable avec 360dialog, au même format).
 * - Si WHATSAPP_TEMPLATE_NAME est défini : message « modèle » (autorisé hors fenêtre de 24 h),
 *   le texte est passé en variable {{1}}. Modèle conseillé, langue fr : « JAMAAL : {{1}} ».
 * - Sinon : message texte libre (n'arrive que si le destinataire a écrit dans les dernières 24 h).
 */
export async function sendViaMeta(to: string, text: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;

  const payload = template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "fr" },
          components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s*\n+\s*/g, " ").slice(0, 900) }] }],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } };

  const res = await fetch(`${API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok) return { status: "ECHEC", error: `${data.error?.code ?? res.status} ${data.error?.message ?? ""}`.trim().slice(0, 300) };
  return { status: "ENVOYE", providerId: data.messages?.[0]?.id };
}
