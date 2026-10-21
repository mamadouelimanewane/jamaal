import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { getBusinessModel } from "./business-model-store";
import { commissionRatesText, LEGACY_RATES_BLOCK, normalizeProtocol, withRates, type ProtocolDoc } from "./protocol";

const KEY = "partner_protocol";

async function readStored(): Promise<ProtocolDoc> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    return normalizeProtocol(row ? JSON.parse(row.value) : null);
  } catch {
    return normalizeProtocol(null);
  }
}

async function write(doc: ProtocolDoc) {
  const value = JSON.stringify(doc);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}

async function currentRatesText(): Promise<string> {
  return commissionRatesText(await getBusinessModel());
}

/**
 * Texte brut (avec {taux_commissions}), pour l'éditeur du back-office. Garde le contrat aligné sur la plateforme :
 * - l'ancien article 8 aux taux écrits en dur est remplacé par {taux_commissions} ;
 * - quand les taux du modèle économique changent, une nouvelle version est créée (à signer de nouveau).
 */
export async function getProtocolRaw(): Promise<ProtocolDoc> {
  const doc = await readStored();
  const rates = await currentRatesText().catch(() => null);
  if (!rates) return doc;
  let text = doc.text;
  let changed = false;
  if (text.includes(LEGACY_RATES_BLOCK)) {
    text = text.replace(LEGACY_RATES_BLOCK, "{taux_commissions}");
    changed = true;
  }
  if (text.includes("{taux_commissions}") && doc.rates !== rates) {
    // Première fois (aucun taux mémorisé) : on mémorise sans changer de version, sauf si le texte vient d'être corrigé.
    changed = changed || doc.rates !== null;
    const next: ProtocolDoc = { ...doc, text, rates, version: changed ? doc.version + 1 : doc.version, updatedAt: changed ? new Date().toISOString() : doc.updatedAt };
    await write(next).catch(() => {});
    return next;
  }
  if (changed) {
    const next: ProtocolDoc = { ...doc, text, version: doc.version + 1, updatedAt: new Date().toISOString() };
    await write(next).catch(() => {});
    return next;
  }
  return doc;
}

/** Protocole à lire et à signer : taux de commission en vigueur déjà inscrits. */
export async function getProtocol(): Promise<ProtocolDoc> {
  const doc = await getProtocolRaw();
  return { ...doc, text: withRates(doc.text, doc.rates ?? (await currentRatesText().catch(() => "")) ) };
}

/** Enregistre un nouveau texte : nouvelle version (les signatures précédentes restent sur leur version). */
export async function saveProtocol(text: string): Promise<ProtocolDoc> {
  const current = await getProtocolRaw();
  const rates = await currentRatesText().catch(() => current.rates ?? null);
  const next = normalizeProtocol({ version: current.text.trim() === text.trim() ? current.version : current.version + 1, text, updatedAt: new Date().toISOString(), rates });
  await write(next);
  return next;
}

export const textHash = (text: string) => createHash("sha256").update(text).digest("hex");
