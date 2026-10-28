import { prisma } from "./prisma";
import { normalizeInstallments, type InstallmentSettings } from "./installments";

const KEY = "paiement_echelonne";

/** Réglages du paiement en plusieurs fois (valeurs par défaut si rien n'est enregistré). */
export async function getInstallmentSettings(): Promise<InstallmentSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    return normalizeInstallments(row ? JSON.parse(row.value) : null);
  } catch {
    return normalizeInstallments(null);
  }
}

export async function saveInstallmentSettings(s: InstallmentSettings) {
  const value = JSON.stringify(normalizeInstallments(s));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
