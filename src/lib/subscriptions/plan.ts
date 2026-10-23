/**
 * Abonnement de réassort : règles pures (testées). Le client reçoit ses produits tous les 30, 45, 60 ou 90
 * jours avec une remise abonné ; la commande est créée automatiquement et payée en un clic.
 */
export const INTERVALS = [30, 45, 60, 90] as const;
export const DEFAULT_INTERVAL = 45;
export const DEFAULT_DISCOUNT_PCT = 5;
export const REMIND_DAYS_BEFORE = 3;
const DAY = 86_400_000;

export type SubItem = { productId: string; productName: string; volumeLabel: string; quantity: number };
export type SubDelivery = { mode: "LIVRAISON" | "RETRAIT"; lat?: number | null; lng?: number | null; address?: string | null; place?: string | null };

export const validInterval = (raw: unknown): number => {
  const n = Number(raw);
  return (INTERVALS as readonly number[]).includes(n) ? n : DEFAULT_INTERVAL;
};

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

/** Remise abonné sur le montant des produits (0 à 30 %). */
export function subscriptionDiscount(productsTotal: number, pct: number): number {
  const p = Math.max(0, Math.min(30, Math.round(pct)));
  return productsTotal > 0 ? Math.round((productsTotal * p) / 100) : 0;
}

export function parseSubItems(raw: unknown): SubItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.productId === "string" && r.productId)
    .map((r) => ({ productId: String(r.productId), productName: String(r.productName ?? "").slice(0, 120), volumeLabel: String(r.volumeLabel ?? "").slice(0, 40), quantity: Math.min(20, Math.max(1, Math.round(Number(r.quantity) || 1))) }))
    .slice(0, 15);
}

export function parseSubDelivery(raw: unknown): SubDelivery {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.mode === "LIVRAISON" && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))) {
    return { mode: "LIVRAISON", lat: Number(r.lat), lng: Number(r.lng), address: r.address ? String(r.address).slice(0, 300) : null, place: r.place ? String(r.place).slice(0, 120) : null };
  }
  return { mode: "RETRAIT" };
}

type SubState = { status: string; nextRunAt: Date; remindedAt: Date | null };
/** Rappel à envoyer : abonnement actif, commande dans 3 jours au plus, pas encore rappelé pour cette échéance. */
export const needsReminder = (s: SubState, now: Date) =>
  s.status === "ACTIVE" && s.nextRunAt.getTime() - now.getTime() <= REMIND_DAYS_BEFORE * DAY && s.nextRunAt.getTime() > now.getTime() && (!s.remindedAt || s.remindedAt.getTime() < s.nextRunAt.getTime() - (REMIND_DAYS_BEFORE + 1) * DAY);
export const isDue = (s: SubState, now: Date) => s.status === "ACTIVE" && s.nextRunAt.getTime() <= now.getTime();

export const itemsLabel = (items: SubItem[]) => items.map((i) => `${i.productName}${i.volumeLabel && i.volumeLabel !== "Unique" ? ` (${i.volumeLabel})` : ""}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ");
export const intervalLabel = (days: number) => (days % 30 === 0 ? `tous les ${days / 30 === 1 ? "mois" : `${days / 30} mois`}` : `tous les ${days} jours`);

type PricedProduct = { id: string; name: string; volumes: unknown; regularPrice: number | null };
/** Articles de l'abonnement au prix du jour (format retrouvé par son nom) ; un format disparu est signalé. */
export function repriceItems(items: SubItem[], products: PricedProduct[]): { priced: (SubItem & { price: number })[]; missing: string[] } {
  const map = new Map(products.map((p) => [p.id, p]));
  const priced: (SubItem & { price: number })[] = [];
  const missing: string[] = [];
  for (const it of items) {
    const p = map.get(it.productId);
    const volumes = Array.isArray(p?.volumes) ? (p!.volumes as { label?: string; price?: number }[]) : [];
    const v = volumes.find((x) => x.label === it.volumeLabel) ?? (volumes.length === 1 ? volumes[0] : undefined);
    const price = v?.price ?? (!volumes.length ? p?.regularPrice ?? null : null);
    if (!p || !price || price <= 0) missing.push(it.productName);
    else priced.push({ ...it, productName: p.name, volumeLabel: v?.label ?? it.volumeLabel, price });
  }
  return { priced, missing };
}
