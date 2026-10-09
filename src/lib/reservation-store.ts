import { prisma } from "./prisma";
import { normalizeReservation, type ReservationSettings } from "./reservation";

const KEY = "reservation_settings";

/** Réglages de réservation en vigueur (valeurs par défaut si rien n'est enregistré). */
export async function getReservationSettings(): Promise<ReservationSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    return normalizeReservation(row ? JSON.parse(row.value) : null);
  } catch {
    return normalizeReservation(null);
  }
}

export async function saveReservationSettings(s: ReservationSettings) {
  const value = JSON.stringify(normalizeReservation(s));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
