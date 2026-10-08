import { prisma } from "./prisma";
import { getBusinessModel, saveBusinessModel } from "./business-model-store";

/*
 * Taux de commission : ils font partie du modèle économique (Admin > Modèle économique).
 * Ces fonctions sont conservées pour les écrans qui les utilisaient déjà.
 */

/** Commission du vendeur sur ses propres ventes (% du prix de vente). */
export async function getCommissionRate(): Promise<number> {
  return (await getBusinessModel()).sellerPct;
}

export async function setCommissionRate(rate: number) {
  const model = await getBusinessModel();
  await saveBusinessModel({ ...model, sellerPct: rate });
}

/** Part du parrain direct lorsqu'il est seul (sans grand-parrain au-dessus de lui). */
export async function getSponsorCommissionRate(): Promise<number> {
  return (await getBusinessModel()).sponsorAlonePct;
}

export async function setSponsorCommissionRate(rate: number) {
  const model = await getBusinessModel();
  await saveBusinessModel({ ...model, sponsorAlonePct: rate });
}

/** Part du grand-parrain (niveau 2). */
export async function getSponsorL2CommissionRate(): Promise<number> {
  return (await getBusinessModel()).grandSponsorPct;
}

export async function setSponsorL2CommissionRate(rate: number) {
  const model = await getBusinessModel();
  await saveBusinessModel({ ...model, grandSponsorPct: rate });
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
