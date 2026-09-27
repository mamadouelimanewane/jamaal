import { prisma } from "./prisma";

const DEFAULT_COMMISSION_RATE = 10; // %

export async function getCommissionRate(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: "commission_rate" } });
  if (!setting) return DEFAULT_COMMISSION_RATE;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_COMMISSION_RATE;
}

export async function setCommissionRate(rate: number) {
  await prisma.setting.upsert({
    where: { key: "commission_rate" },
    update: { value: String(rate) },
    create: { key: "commission_rate", value: String(rate) },
  });
}
