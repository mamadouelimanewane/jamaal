import { prisma } from "./prisma";

const DEFAULT_COMMISSION_RATE = 10; // % sur les ventes directes du consultant
const DEFAULT_SPONSOR_RATE = 5; // % sur le CA des filleuls (niveau 1)

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

/** Commission de parrainage (sur le CA des filleuls directs). */
export async function getSponsorCommissionRate(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: "sponsor_commission_rate" } });
  if (!setting) return DEFAULT_SPONSOR_RATE;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SPONSOR_RATE;
}

export async function setSponsorCommissionRate(rate: number) {
  await prisma.setting.upsert({
    where: { key: "sponsor_commission_rate" },
    update: { value: String(rate) },
    create: { key: "sponsor_commission_rate", value: String(rate) },
  });
}

const DEFAULT_SPONSOR_L2_RATE = 2; // % sur le CA des filleuls de niveau 2

/** Commission parrainage niveau 2 (petite-filleuls). */
export async function getSponsorL2CommissionRate(): Promise<number> {
  const setting = await prisma.setting.findUnique({
    where: { key: "sponsor_l2_commission_rate" },
  });
  if (!setting) return DEFAULT_SPONSOR_L2_RATE;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SPONSOR_L2_RATE;
}

export async function setSponsorL2CommissionRate(rate: number) {
  await prisma.setting.upsert({
    where: { key: "sponsor_l2_commission_rate" },
    update: { value: String(rate) },
    create: { key: "sponsor_l2_commission_rate", value: String(rate) },
  });
}

export async function getLoyaltySettings() {
  const earningRateSet = await prisma.setting.findUnique({ where: { key: "loyalty_earning_rate" } });
  const spendThresholdSet = await prisma.setting.findUnique({ where: { key: "loyalty_spend_threshold" } });
  return {
    earningRate: earningRateSet ? Number(earningRateSet.value) : 1,
    spendThreshold: spendThresholdSet ? Number(spendThresholdSet.value) : 10000,
  };
}

export async function setLoyaltySettings(earningRate: number, spendThreshold: number) {
  await prisma.setting.upsert({ where: { key: "loyalty_earning_rate" }, update: { value: String(earningRate) }, create: { key: "loyalty_earning_rate", value: String(earningRate) } });
  await prisma.setting.upsert({ where: { key: "loyalty_spend_threshold" }, update: { value: String(spendThreshold) }, create: { key: "loyalty_spend_threshold", value: String(spendThreshold) } });
}
