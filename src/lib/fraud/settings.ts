import { prisma } from "@/lib/prisma";

const KEY = "antifraude_actif";

/**
 * Contrôle anti-fraude des commissions : actif ou suspendu (Admin › Contrôle des commissions).
 * Suspendu tant que l'administrateur ne l'a pas réactivé (demande du 29/10/2026).
 */
export async function fraudControlEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  return row?.value === "1";
}

export async function setFraudControl(on: boolean) {
  const value = on ? "1" : "0";
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
