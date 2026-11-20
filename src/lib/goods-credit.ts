/**
 * Crédits de marchandises des revendeurs.
 * L'admin confie des marchandises à crédit (Admin › Crédits revendeurs). Chaque vente du revendeur payée à JAMAAL
 * (en ligne, « Paiement reçu » ou espèces encaissées par le livreur) est défalquée automatiquement de ce qu'il doit,
 * en commençant par le crédit le plus ancien. Une vente annulée rend son montant au crédit.
 */
import type { GoodsCreditStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";

export type CreditItem = { productId?: string | null; name: string; qty: number; unitPrice: number; /** Format confié (« 30 ml »), facultatif. */ format?: string | null };

export const CREDIT_STATUS_LABELS: Record<GoodsCreditStatus, string> = { EN_COURS: "En cours", SOLDE: "Soldé", ANNULE: "Annulé" };
export const ENTRY_LABELS: Record<string, string> = {
  VENTE: "Vente défalquée",
  VERSEMENT: "Versement",
  ANNULATION_VENTE: "Vente annulée (rendue au crédit)",
  ANNULATION_CREDIT: "Crédit annulé",
};

export function parseItems(v: unknown): CreditItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => x as Partial<CreditItem>)
    .filter((x) => x && typeof x.name === "string" && x.name.trim())
    .map((x) => ({
      productId: x.productId || null,
      name: String(x.name).slice(0, 120),
      qty: Math.max(0, Math.round(Number(x.qty) || 0)),
      unitPrice: Math.max(0, Math.round(Number(x.unitPrice) || 0)),
      ...(typeof x.format === "string" && x.format.trim() ? { format: x.format.trim().slice(0, 60) } : {}),
    }));
}

type OrderForCredit = { total: number; deliveryFee: number; items: { productId: string | null; price: number; quantity: number; volumeLabel?: string | null }[] };

const normFormat = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** La ligne de commande correspond-elle à un produit confié (et à son format, s'il est précisé) ? */
function lineMatches(items: CreditItem[], line: OrderForCredit["items"][number]) {
  return items.some((i) => i.productId && i.productId === line.productId && (!i.format || normFormat(i.format) === normFormat(line.volumeLabel)));
}
type CreditForAlloc = { id: string; balance: number; items: CreditItem[] };

/** Montant de la vente (hors livraison). */
export const saleAmount = (o: OrderForCredit) => Math.max(0, o.total - (o.deliveryFee ?? 0));

/**
 * Répartit une vente sur les crédits en cours, du plus ancien au plus récent.
 * Un crédit qui liste des produits n'est remboursé que par la vente de ces produits ; sans liste, par toute la vente.
 */
export function allocateSale(order: OrderForCredit, credits: CreditForAlloc[]): { creditId: string; amount: number }[] {
  let left = saleAmount(order);
  const out: { creditId: string; amount: number }[] = [];
  for (const c of credits) {
    if (left <= 0) break;
    if (c.balance <= 0) continue;
    const listed = c.items.some((i) => i.productId);
    const eligible = listed ? Math.min(left, order.items.filter((l) => lineMatches(c.items, l)).reduce((s, l) => s + l.price * l.quantity, 0)) : left;
    const take = Math.min(c.balance, eligible);
    if (take > 0) {
      out.push({ creditId: c.id, amount: take });
      left -= take;
    }
  }
  return out;
}

/** CM-2026-0001 */
export async function nextReference(tx: Prisma.TransactionClient = prisma) {
  const year = new Date().getFullYear();
  const last = await tx.goodsCredit.findFirst({ where: { reference: { startsWith: `CM-${year}-` } }, orderBy: { reference: "desc" }, select: { reference: true } });
  const n = last ? Number(last.reference.split("-")[2]) + 1 : 1;
  return `CM-${year}-${String(n).padStart(4, "0")}`;
}

async function notifyReseller(consultantId: string, title: string, message: string, orderId?: string | null) {
  const user = await prisma.user.findFirst({ where: { consultantId }, select: { id: true } });
  if (!user) return;
  await prisma.notification.create({ data: { userId: user.id, title, message, ...(orderId ? { orderId } : {}) } }).catch(() => {});
}

/** Dette totale d'un revendeur (crédits en cours). */
export async function resellerDebt(consultantId: string) {
  const a = await prisma.goodsCredit.aggregate({ where: { consultantId, status: "EN_COURS" }, _sum: { balance: true } });
  return a._sum.balance ?? 0;
}

/**
 * Défalque une vente payée des crédits du revendeur. Sans effet si la vente n'est pas payée à JAMAAL
 * (encaissée par le revendeur ou payée avec son wallet), annulée, ou déjà défalquée.
 */
export async function deductFromGoodsCreditForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { consultantId: true, paymentStatus: true, paymentMethod: true, status: true, total: true, deliveryFee: true, items: { select: { productId: true, price: true, quantity: true, volumeLabel: true } } },
  });
  if (!order?.consultantId || order.paymentStatus !== "PAYE" || order.status === "ANNULEE" || order.paymentMethod === "WALLET") return [];
  const consultantId = order.consultantId;
  const done = await prisma.goodsCreditDeduction.findMany({ where: { orderId, kind: "VENTE" }, select: { creditId: true } });
  const credits = await prisma.goodsCredit.findMany({
    where: { consultantId, status: "EN_COURS", balance: { gt: 0 }, id: { notIn: done.map((d) => d.creditId) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, balance: true, items: true, reference: true },
  });
  if (!credits.length) return [];
  const plan = allocateSale(order, credits.map((c) => ({ id: c.id, balance: c.balance, items: parseItems(c.items) })));
  const applied: { reference: string; amount: number; balanceAfter: number }[] = [];
  for (const p of plan) {
    try {
      const r = await prisma.$transaction(async (tx) => {
        const c = await tx.goodsCredit.findUnique({ where: { id: p.creditId }, select: { balance: true, status: true, reference: true } });
        if (!c || c.status !== "EN_COURS" || c.balance <= 0) return null;
        const amount = Math.min(p.amount, c.balance);
        const after = c.balance - amount;
        await tx.goodsCreditDeduction.create({ data: { creditId: p.creditId, kind: "VENTE", orderId, amount, balanceBefore: c.balance, balanceAfter: after, note: `Commande ${orderId.slice(-8).toUpperCase()}` } });
        await tx.goodsCredit.update({ where: { id: p.creditId }, data: { balance: after, repaid: { increment: amount }, ...(after === 0 ? { status: "SOLDE", closedAt: new Date() } : {}) } });
        return { reference: c.reference, amount, balanceAfter: after };
      });
      if (r) applied.push(r);
    } catch (e) {
      // Défalcation déjà faite par un appel concurrent (index unique) : rien à faire.
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }
  if (applied.length) {
    const total = applied.reduce((s, a) => s + a.amount, 0);
    const debt = await resellerDebt(consultantId);
    await notifyReseller(
      consultantId,
      "Crédit marchandises : vente défalquée",
      `${formatPrice(total)} de votre vente (commande ${orderId.slice(-8).toUpperCase()}) ont été défalqués de votre crédit. Reste dû : ${formatPrice(debt)}.${applied.some((a) => a.balanceAfter === 0) ? " Un crédit est soldé." : ""}`,
      orderId,
    );
  }
  return applied;
}

/** Vente annulée : les montants défalqués reviennent sur les crédits concernés. */
export async function reverseGoodsCreditForOrder(orderId: string) {
  const sales = await prisma.goodsCreditDeduction.findMany({ where: { orderId, kind: "VENTE" } });
  if (!sales.length) return 0;
  const reversed = new Set((await prisma.goodsCreditDeduction.findMany({ where: { orderId, kind: "ANNULATION_VENTE" }, select: { creditId: true } })).map((r) => r.creditId));
  let total = 0;
  for (const s of sales) {
    if (reversed.has(s.creditId)) continue;
    await prisma.$transaction(async (tx) => {
      const c = await tx.goodsCredit.findUnique({ where: { id: s.creditId }, select: { balance: true, status: true } });
      if (!c) return;
      const after = c.balance + s.amount;
      await tx.goodsCreditDeduction.create({ data: { creditId: s.creditId, kind: "ANNULATION_VENTE", orderId, amount: -s.amount, balanceBefore: c.balance, balanceAfter: after, note: `Commande ${orderId.slice(-8).toUpperCase()} annulée` } });
      await tx.goodsCredit.update({ where: { id: s.creditId }, data: { balance: after, repaid: { decrement: s.amount }, ...(c.status === "SOLDE" ? { status: "EN_COURS", closedAt: null } : {}) } });
    });
    total += s.amount;
  }
  return total;
}

/** Défalcation sans jamais bloquer un paiement ou une annulation. */
export async function safeDeduct(orderId: string) {
  await deductFromGoodsCreditForOrder(orderId).catch((e) => console.error("[crédit marchandises] défalcation", orderId, e));
}
export async function safeReverse(orderId: string) {
  await reverseGoodsCreditForOrder(orderId).catch((e) => console.error("[crédit marchandises] annulation", orderId, e));
}

export { notifyReseller as notifyResellerOfCredit };
