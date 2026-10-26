/**
 * État de la mise à jour depuis Chogan : date et résultat de la dernière passe (automatique ou manuelle),
 * avec repli sur la date de vérification la plus récente des fiches pour les passes antérieures.
 */
import { prisma } from "@/lib/prisma";

export const LAST_SYNC_KEY = "chogan_derniere_maj";
export type LastSync = { at: string; source: "auto" | "manuel"; verifies: number; prixMisAJour: number; nouveautes: number; erreurs: number };

export async function recordChoganSync(r: Omit<LastSync, "at">, at = new Date()) {
  const value = JSON.stringify({ ...r, at: at.toISOString() });
  await prisma.setting.upsert({ where: { key: LAST_SYNC_KEY }, create: { key: LAST_SYNC_KEY, value }, update: { value } }).catch(() => {});
}

export async function getChoganSyncStatus() {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [row, lastCheck, lastImport, lastPrice, linked, checked30] = await Promise.all([
    prisma.setting.findUnique({ where: { key: LAST_SYNC_KEY } }).catch(() => null),
    prisma.product.aggregate({ _max: { choganCheckedAt: true }, where: { number: { not: null } } }),
    prisma.product.findFirst({ where: { number: { not: null } }, orderBy: { createdAt: "desc" }, select: { name: true, createdAt: true } }),
    prisma.choganPriceChange.findFirst({ orderBy: { detectedAt: "desc" }, select: { name: true, detectedAt: true } }),
    prisma.product.count({ where: { number: { not: null } } }),
    prisma.product.count({ where: { number: { not: null }, choganCheckedAt: { gte: since30 } } }),
  ]);
  let last: LastSync | null = null;
  try {
    last = row ? (JSON.parse(row.value) as LastSync) : null;
  } catch {
    last = null;
  }
  const lastAt = last ? new Date(last.at) : lastCheck._max.choganCheckedAt ?? null;
  return { last, lastAt, lastImport, lastPrice, linked, checked30 };
}

/** « lundi 26 octobre 2026 à 08:02 » (heure de Dakar). */
export const frDateTime = (d: Date) =>
  `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" })}`;
