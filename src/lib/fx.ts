import { cache } from "react";
import { prisma } from "./prisma";
import { MRU_DEFAULT_RATE } from "./currency";

const KEY = "fx_mru_rate";

/** Nombre de FCFA pour 1 ouguiya (MRU), réglé dans Admin > Réglages. */
export const getMruRate = cache(async (): Promise<number> => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const v = row ? Number(row.value) : NaN;
    return Number.isFinite(v) && v > 0 ? v : MRU_DEFAULT_RATE;
  } catch {
    return MRU_DEFAULT_RATE;
  }
});

export async function setMruRate(rate: number) {
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: String(rate) }, create: { key: KEY, value: String(rate) } });
}
