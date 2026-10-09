import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { normalizeProtocol, type ProtocolDoc } from "./protocol";

const KEY = "partner_protocol";

export async function getProtocol(): Promise<ProtocolDoc> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    return normalizeProtocol(row ? JSON.parse(row.value) : null);
  } catch {
    return normalizeProtocol(null);
  }
}

/** Enregistre un nouveau texte : nouvelle version (les signatures précédentes restent sur leur version). */
export async function saveProtocol(text: string): Promise<ProtocolDoc> {
  const current = await getProtocol();
  const next = normalizeProtocol({ version: current.text.trim() === text.trim() ? current.version : current.version + 1, text, updatedAt: new Date().toISOString() });
  const value = JSON.stringify(next);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return next;
}

export const textHash = (text: string) => createHash("sha256").update(text).digest("hex");
