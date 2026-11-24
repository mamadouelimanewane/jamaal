import { cache } from "react";
import { prisma } from "./prisma";
import { GMD_DEFAULT_RATE, MRU_DEFAULT_RATE } from "./currency";

/** Taux de conversion des versions étrangères du site : nombre de FCFA pour 1 unité (Admin > Réglages). */
const KEYS = { mru: "fx_mru_rate", gmd: "fx_gmd_rate" } as const;
const DEFAULTS = { mru: MRU_DEFAULT_RATE, gmd: GMD_DEFAULT_RATE } as const;
type Cur = keyof typeof KEYS;

const readRate = cache(async (cur: Cur): Promise<number> => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEYS[cur] } });
    const v = row ? Number(row.value) : NaN;
    return Number.isFinite(v) && v > 0 ? v : DEFAULTS[cur];
  } catch {
    return DEFAULTS[cur];
  }
});

/** Nombre de FCFA pour 1 ouguiya (MRU), version arabe. */
export const getMruRate = () => readRate("mru");
/** Nombre de FCFA pour 1 dalasi (GMD), version anglaise. */
export const getGmdRate = () => readRate("gmd");

/** Taux de la monnaie affichée dans une langue (undefined pour le FCFA). */
export async function getRateFor(locale: string): Promise<number | undefined> {
  return locale === "ar" ? getMruRate() : locale === "en" ? getGmdRate() : undefined;
}

async function setRate(cur: Cur, rate: number) {
  await prisma.setting.upsert({ where: { key: KEYS[cur] }, update: { value: String(rate) }, create: { key: KEYS[cur], value: String(rate) } });
}
export const setMruRate = (rate: number) => setRate("mru", rate);
export const setGmdRate = (rate: number) => setRate("gmd", rate);
