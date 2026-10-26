/**
 * Détail des ventes derrière un gain : produits vendus et acheteur, pour les notifications de commission et de
 * retrait. Les ventes de l'équipe n'affichent que le prénom et l'initiale du client du filleul.
 */
import { prisma } from "./prisma";

export type SaleDetail = { orderId: string; ref: string; products: string; buyer: string; sellerId: string | null; sellerName: string | null };

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;

/** « Awa Diop » → « Awa D. » */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "client";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** « Aqua Soul for Him 50 ml ×2, Rêve Parisien 30 ml » (3 produits au plus, puis « +N »). */
export function productsLabel(items: { productName: string; volumeLabel: string; quantity: number }[]): string {
  const fmt = (i: (typeof items)[number]) => `${i.productName}${i.volumeLabel && i.volumeLabel !== "Format unique" ? ` ${i.volumeLabel}` : ""}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`;
  const shown = items.slice(0, 3).map(fmt).join(", ");
  return items.length > 3 ? `${shown} +${items.length - 3}` : shown || "commande";
}

/**
 * Une ligne de gain (pur, testé) : « 2 600 F · Aqua Soul 50 ml, acheteur Awa Diop (commande ABCD1234) ».
 * `viewerId` : le bénéficiaire ; s'il n'est pas le vendeur, c'est une vente de son équipe.
 */
export function gainLine(g: { amount: number; level: string }, d: SaleDetail | undefined, viewerId: string): string {
  if (g.level.startsWith("PRIME_")) return `${fcfa(g.amount)} · prime d'équipe`;
  if (!d) return `${fcfa(g.amount)} · ${g.level === "LIVRAISON" ? "livraison" : "commission"}`;
  if (g.level === "LIVRAISON") return `${fcfa(g.amount)} · livraison chez ${shortName(d.buyer)} (${d.products}, commande ${d.ref})`;
  const own = !d.sellerId || d.sellerId === viewerId;
  const buyer = own ? d.buyer : shortName(d.buyer);
  return `${fcfa(g.amount)} · ${d.products}, acheteur ${buyer}${own ? "" : `, vendu par ${d.sellerName ?? "votre équipe"}`} (commande ${d.ref})`;
}

/** Détails des commandes (produits, acheteur, vendeur). */
export async function saleDetails(orderIds: (string | null | undefined)[]): Promise<Map<string, SaleDetail>> {
  const ids = [...new Set(orderIds.filter((id): id is string => !!id && !id.startsWith("PRIME-")))];
  if (!ids.length) return new Map();
  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { id: true, customerName: true, consultantId: true, consultant: { select: { name: true } }, items: { select: { productName: true, volumeLabel: true, quantity: true } } },
  });
  return new Map(orders.map((o) => [o.id, { orderId: o.id, ref: o.id.slice(-8).toUpperCase(), products: productsLabel(o.items), buyer: o.customerName, sellerId: o.consultantId, sellerName: o.consultant?.name ?? null }]));
}

/**
 * Gains qui composent un retrait : les crédits (commissions, primes, livraisons) reçus avant le retrait et
 * depuis le retrait versé précédent, du plus récent au plus ancien jusqu'à couvrir le montant (8 au plus).
 */
export async function gainsBehindWithdrawal(t: { id: string; ownerType: string; ownerId: string; amount: number; createdAt: Date }) {
  const previous = await prisma.walletTransaction.findFirst({
    where: { ownerType: t.ownerType, ownerId: t.ownerId, kind: "RETRAIT", status: "VALIDE", id: { not: t.id }, createdAt: { lt: t.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const credits = await prisma.walletTransaction.findMany({
    where: { ownerType: t.ownerType, ownerId: t.ownerId, kind: { in: ["COMMISSION", "PRIME", "LIVRAISON"] }, status: "VALIDE", amount: { gt: 0 }, createdAt: { lte: t.createdAt, ...(previous ? { gt: previous.createdAt } : {}) } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { amount: true, kind: true, orderId: true, sourceId: true },
  });
  const target = Math.abs(t.amount);
  const picked: typeof credits = [];
  let sum = 0;
  for (const c of credits) {
    if (sum >= target || picked.length >= 8) break;
    picked.push(c);
    sum += c.amount;
  }
  const details = await saleDetails(picked.map((c) => c.orderId));
  const levelOf = (c: (typeof picked)[number]) => (c.kind === "PRIME" ? "PRIME_EQUIPE" : c.kind === "LIVRAISON" ? "LIVRAISON" : "VENTE");
  const lines = picked.map((c) => gainLine({ amount: c.amount, level: levelOf(c) }, c.orderId ? details.get(c.orderId) : undefined, t.ownerId));
  return { lines, more: credits.length > picked.length && sum < target };
}
