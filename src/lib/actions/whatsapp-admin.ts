"use server";

import { revalidatePath } from "next/cache";
import { sendWhatsApp, normalizePhone, type WhatsAppKind } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { isMessageKey, saveCustomMessage, unknownVars } from "@/lib/whatsapp/message-templates";
import { requireAdmin } from "./auth-guard";

export type TestState = { ok: boolean; message?: string };

/** Envoie un message de test au numéro indiqué (administrateur uniquement). */
export async function sendTestWhatsApp(_prev: TestState, formData: FormData): Promise<TestState> {
  await requireAdmin("whatsapp");
  const to = normalizePhone(String(formData.get("to") ?? ""));
  const text = String(formData.get("text") ?? "").trim() || "Test JAMAAL : ceci est un message de test envoyé depuis le back-office.";
  if (to.length < 9 || to.length > 15) return { ok: false, message: "Numéro invalide (format international, ex. 221770000000)." };

  const r = await sendWhatsApp({ to, text: text.slice(0, 500), kind: "test" });
  revalidatePath("/admin/journal-whatsapp");
  if (r.status === "ENVOYE") return { ok: true, message: "Message envoyé au prestataire. Vérifiez la réception sur le téléphone." };
  if (r.status === "SIMULE") return { ok: true, message: "Mode simulation : aucun prestataire configuré, le message est seulement enregistré dans le journal." };
  return { ok: false, message: `Échec : ${r.error ?? "erreur inconnue"}` };
}

export type MessageEditState = { ok: boolean; message?: string };

/** Enregistre (ou rétablit) le texte d'un message automatique. */
export async function saveWhatsAppMessage(_prev: MessageEditState, formData: FormData): Promise<MessageEditState> {
  await requireAdmin("whatsapp", "write");
  const key = formData.get("key");
  if (!isMessageKey(key)) return { ok: false, message: "Message inconnu." };
  const reset = formData.get("reset") === "1";
  const text = String(formData.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  if (!reset) {
    if (text.length < 10) return { ok: false, message: "Texte trop court." };
    if (text.length > 1000) return { ok: false, message: "1 000 caractères au plus." };
    const unknown = unknownVars(key, text);
    if (unknown.length) return { ok: false, message: `Variable inconnue : ${unknown.map((v) => `{${v}}`).join(", ")}. Utilisez les variables proposées sous le texte.` };
  }
  await saveCustomMessage(key, reset ? null : text);
  revalidatePath("/admin/journal-whatsapp");
  return { ok: true, message: reset ? "Texte d'origine rétabli." : "Message enregistré : il sera utilisé dès le prochain envoi." };
}

/** Renvoie un message en échec (après avoir corrigé la configuration). */
export async function resendWhatsAppMessage(id: string) {
  await requireAdmin("whatsapp", "write");
  const m = await prisma.whatsAppMessage.findUnique({ where: { id }, select: { direction: true, status: true, toNumber: true, body: true, kind: true } });
  if (!m || m.direction !== "OUT" || m.status !== "ECHEC") return;
  await sendWhatsApp({ to: m.toNumber, text: m.body, kind: (m.kind as WhatsAppKind) ?? "test" });
  revalidatePath("/admin/journal-whatsapp");
}
