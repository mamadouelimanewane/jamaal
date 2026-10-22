/**
 * Messages WhatsApp automatiques modifiables : lecture et enregistrement des textes (table Setting).
 * Fichier serveur ; définitions et remplissage dans message-templates-data.ts.
 */
import { prisma } from "@/lib/prisma";
import { fillTemplate, isMessageKey, WA_MESSAGES, type MessageKey } from "./message-templates-data";

export * from "./message-templates-data";

const SETTING_KEY = "wa_messages";

/** Textes modifiés par l'administrateur. */
export async function getCustomMessages(): Promise<Partial<Record<MessageKey, string>>> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const raw = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    const out: Partial<Record<MessageKey, string>> = {};
    for (const [k, v] of Object.entries(raw)) if (isMessageKey(k) && typeof v === "string" && v.trim()) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export async function saveCustomMessage(key: MessageKey, text: string | null) {
  const current = await getCustomMessages();
  if (text && text.trim() && text.trim() !== WA_MESSAGES[key].text) current[key] = text.trim().slice(0, 1000);
  else delete current[key];
  const value = JSON.stringify(current);
  await prisma.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
}

/**
 * Texte à envoyer : le message modifié par l'admin (variables remplies) s'il existe, sinon le texte d'origine
 * calculé par l'envoi. Ne lève jamais d'erreur.
 */
export async function messageText(key: MessageKey, vars: Record<string, string | number | null | undefined>, original: string): Promise<string> {
  const custom = (await getCustomMessages())[key];
  return custom ? fillTemplate(custom, vars) || original : original;
}
