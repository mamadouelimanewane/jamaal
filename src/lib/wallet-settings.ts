import { prisma } from "./prisma";

const KEY = "wallet_deposit_numbers";
export type DepositNumbers = { WAVE: string; ORANGE_MONEY: string };

/** Numéros Wave / Orange Money de JAMAAL sur lesquels les membres envoient leurs dépôts. */
export async function getDepositNumbers(): Promise<DepositNumbers> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const v = row ? (JSON.parse(row.value) as Partial<DepositNumbers>) : {};
    return { WAVE: v.WAVE ?? "", ORANGE_MONEY: v.ORANGE_MONEY ?? "" };
  } catch {
    return { WAVE: "", ORANGE_MONEY: "" };
  }
}

export async function saveDepositNumbers(n: DepositNumbers) {
  const clean = (s: string) => s.replace(/[^\d+ ]/g, "").trim().slice(0, 20);
  const value = JSON.stringify({ WAVE: clean(n.WAVE), ORANGE_MONEY: clean(n.ORANGE_MONEY) });
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
