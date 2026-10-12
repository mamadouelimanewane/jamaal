/**
 * Recherche par numéro de téléphone tolérante au format saisi (« 77 600 00 01 », « +221… »,
 * « 00221… ») : on compare les 9 derniers chiffres. Les fiches clients et les commandes gardent
 * le numéro tel que tapé, d'où cette comparaison côté base.
 */
import { prisma } from "@/lib/prisma";

export const phoneTail = (raw: string | null | undefined) => {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
};

export async function customerIdsByPhone(raw: string): Promise<string[]> {
  const key = phoneTail(raw);
  if (!key) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${key}`;
  return rows.map((r) => r.id);
}

/** Le client a-t-il répondu STOP (sur l'une de ses fiches) ? */
export async function phoneOptedOut(raw: string): Promise<boolean> {
  const ids = await customerIdsByPhone(raw);
  return ids.length ? (await prisma.customer.count({ where: { id: { in: ids }, whatsappOptOut: true } })) > 0 : false;
}

export async function setPhoneOptOut(raw: string, out: boolean): Promise<number> {
  const ids = await customerIdsByPhone(raw);
  if (!ids.length) return 0;
  return (await prisma.customer.updateMany({ where: { id: { in: ids } }, data: { whatsappOptOut: out } })).count;
}

/** Nombre de commandes non annulées de ce numéro passées après une date. */
export async function ordersByPhoneSince(raw: string, after: Date): Promise<number> {
  const key = phoneTail(raw);
  if (!key) return 0;
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Order" WHERE "status" <> 'ANNULEE' AND "createdAt" > ${after} AND right(regexp_replace(coalesce("customerPhone", ''), '[^0-9]', '', 'g'), 9) = ${key}`;
  return Number(rows[0]?.n ?? 0);
}
