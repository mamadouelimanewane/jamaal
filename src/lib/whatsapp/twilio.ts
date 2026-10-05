import type { SendResult } from "./index";

/** Twilio (sandbox WhatsApp ou numéro approuvé). Le destinataire doit avoir rejoint le sandbox pour les tests. */
export async function sendViaTwilio(to: string, text: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN!}`).toString("base64");
  const from = process.env.TWILIO_WHATSAPP_FROM!.replace(/^whatsapp:/, "");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:+${to}`, Body: text }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok) return { status: "ECHEC", error: `${data.code ?? res.status} ${data.message ?? ""}`.trim().slice(0, 300) };
  return { status: "ENVOYE", providerId: data.sid };
}
