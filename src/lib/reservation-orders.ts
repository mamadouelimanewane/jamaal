/**
 * « À commander chez Chogan » pour les réservations : tout ce que les clients ont réservé (acompte payé)
 * et que JAMAAL n'a pas encore commandé chez son fournisseur, regroupé par produit et par format.
 *
 * Le compteur se remet à zéro quand l'admin confirme « commande passée chez Chogan » : on enregistre
 * l'instant de cette commande (réglage `chogan_reservations_ordered_until`) ; seules les réservations
 * dont l'acompte est payé APRÈS cet instant comptent. Aucune modification de la base de données :
 * l'historique des commandes passées est gardé dans un réglage JSON.
 */
import { prisma } from "./prisma";

const CUTOFF_KEY = "chogan_reservations_ordered_until";
const BATCHES_KEY = "chogan_reservations_batches";

export interface PendingCustomer {
  orderId: string;
  name: string;
  phone: string | null;
  quantity: number;
  paidAt: Date;
}

export interface PendingLine {
  key: string;
  code: string | null;
  name: string;
  format: string;
  quantity: number;
  customers: PendingCustomer[];
}

export interface OrderedBatch {
  at: string;
  by: string;
  units: number;
  lines: { code: string | null; name: string; format: string; qty: number }[];
}

export interface RawReservedItem {
  orderId: string;
  customerName: string;
  customerPhone: string | null;
  paidAt: Date;
  productId: string | null;
  variantId: string | null;
  productName: string;
  volumeLabel: string;
  quantity: number;
  code: string | null;
}

/** Regroupe les articles réservés par produit + format (pur, testé) : quantité totale et clients concernés. */
export function aggregateReserved(items: RawReservedItem[]): PendingLine[] {
  const map = new Map<string, PendingLine>();
  for (const it of items) {
    if (it.quantity <= 0) continue;
    const key = `${it.productId ?? it.productName}|${it.variantId ?? ""}|${it.volumeLabel}`;
    const line = map.get(key) ?? { key, code: it.code, name: it.productName, format: it.volumeLabel, quantity: 0, customers: [] };
    line.quantity += it.quantity;
    const same = line.customers.find((c) => c.orderId === it.orderId);
    if (same) same.quantity += it.quantity;
    else line.customers.push({ orderId: it.orderId, name: it.customerName, phone: it.customerPhone, quantity: it.quantity, paidAt: it.paidAt });
    map.set(key, line);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "fr"));
}

export async function getOrderedUntil(): Promise<Date | null> {
  const row = await prisma.setting.findUnique({ where: { key: CUTOFF_KEY } });
  const d = row ? new Date(row.value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** Réservations à commander à l'instant `asOf` (par défaut maintenant). */
export async function pendingReservations(asOf: Date = new Date()) {
  const since = await getOrderedUntil();
  const orders = await prisma.order.findMany({
    where: {
      isReservation: true,
      reservationStatus: "RESERVEE",
      status: { not: "ANNULEE" },
      depositPaidAt: { not: null, lte: asOf, ...(since ? { gt: since } : {}) },
    },
    orderBy: { depositPaidAt: "asc" },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      depositPaidAt: true,
      items: {
        select: {
          productId: true,
          variantId: true,
          productName: true,
          volumeLabel: true,
          quantity: true,
          variant: { select: { code: true } },
          product: { select: { choganCode: true, number: true } },
        },
      },
    },
  });
  const raw: RawReservedItem[] = orders.flatMap((o) =>
    o.items.map((i) => ({
      orderId: o.id,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      paidAt: o.depositPaidAt!,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      volumeLabel: i.volumeLabel,
      quantity: i.quantity,
      code: i.variant?.code ?? i.product?.choganCode ?? (i.product?.number != null ? String(i.product.number) : null),
    }))
  );
  const lines = aggregateReserved(raw);
  return { lines, units: lines.reduce((s, l) => s + l.quantity, 0), orders: orders.length, since, asOf };
}

export async function getOrderedBatches(): Promise<OrderedBatch[]> {
  const row = await prisma.setting.findUnique({ where: { key: BATCHES_KEY } });
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    return Array.isArray(parsed) ? (parsed as OrderedBatch[]) : [];
  } catch {
    return [];
  }
}

/**
 * L'admin a passé la commande chez Chogan : le compteur repart à zéro. Seules les réservations payées
 * jusqu'à `asOf` (l'instant où l'écran a été affiché) sont marquées commandées : une réservation payée
 * entre-temps reste dans le compteur. Retourne null s'il n'y avait rien à marquer.
 */
export async function markReservationsOrdered(asOf: Date, by: string): Promise<OrderedBatch | null> {
  const { lines, units } = await pendingReservations(asOf);
  if (!units) return null;
  const batch: OrderedBatch = { at: new Date().toISOString(), by, units, lines: lines.map((l) => ({ code: l.code, name: l.name, format: l.format, qty: l.quantity })) };
  const history = [batch, ...(await getOrderedBatches())].slice(0, 30);
  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: CUTOFF_KEY }, create: { key: CUTOFF_KEY, value: asOf.toISOString() }, update: { value: asOf.toISOString() } }),
    prisma.setting.upsert({ where: { key: BATCHES_KEY }, create: { key: BATCHES_KEY, value: JSON.stringify(history) }, update: { value: JSON.stringify(history) } }),
  ]);
  return batch;
}
