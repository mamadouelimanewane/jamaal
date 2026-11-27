/**
 * Wallet client (« avoir ») : argent rendu au client par JAMAAL — différence d'un produit remplacé par un moins cher,
 * réservation annulée (moins la pénalité éventuelle). Registre WalletTransaction (ownerType « CUSTOMER »).
 *
 * Le client l'utilise au panier avec son code d'avoir personnel (envoyé sur WhatsApp à chaque crédit, saisi dans
 * « Code promo ») ; l'admin peut aussi le lui verser sur Wave (Admin › Clients). Fichier serveur.
 */
import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma } from "./prisma";
import { walletBalance, type Owner } from "./wallet";
import { formatPrice } from "./currency";
import { upsertCustomerFromOrder } from "./customers";
import { sendWhatsApp } from "./whatsapp";
import { getSiteUrl } from "./site-url";

type Tx = Prisma.TransactionClient;

export const customerOwner = (id: string): Owner => ({ type: "CUSTOMER", id });

/** Solde de l'avoir d'un client (FCFA). */
export async function avoirBalance(customerId: string, db: Tx | typeof prisma = prisma): Promise<number> {
  return (await walletBalance(customerOwner(customerId), db)).available;
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** « AV-7K3P9Q » : lettres et chiffres sans ambiguïté (pas de 0/O, 1/I/L). */
export function newAvoirCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return `AV-${s}`;
}

/** Code d'avoir du client (créé au premier besoin). */
export async function ensureAvoirCode(customerId: string): Promise<string> {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { avoirCode: true } });
  if (c?.avoirCode) return c.avoirCode;
  for (let i = 0; i < 5; i++) {
    const code = newAvoirCode();
    const r = await prisma.customer.updateMany({ where: { id: customerId, avoirCode: null }, data: { avoirCode: code } }).catch(() => ({ count: 0 }));
    if (r.count) return code;
    const again = await prisma.customer.findUnique({ where: { id: customerId }, select: { avoirCode: true } });
    if (again?.avoirCode) return again.avoirCode;
  }
  throw new Error("Code d'avoir impossible à créer.");
}

/** Client d'une commande (fiche créée depuis le nom et le numéro de la commande si besoin). */
export async function customerOfOrder(orderId: string): Promise<{ id: string; name: string; phone: string } | null> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, customerName: true, customerPhone: true } });
  if (!o) return null;
  let id = o.customerId;
  if (!id && o.customerPhone) {
    id = await upsertCustomerFromOrder({ name: o.customerName, phone: o.customerPhone });
    if (id) await prisma.order.update({ where: { id: orderId }, data: { customerId: id } });
  }
  if (!id) return null;
  const c = await prisma.customer.findUnique({ where: { id }, select: { id: true, name: true, phone: true } });
  return c;
}

/**
 * Crédite l'avoir du client (idempotent par sourceId) et le prévient sur WhatsApp avec son code.
 * Retourne le montant crédité (0 si déjà fait ou impossible).
 */
export async function creditAvoir(input: { customerId: string; amount: number; orderId?: string | null; sourceId: string; note: string; reason: string }): Promise<number> {
  const amount = Math.round(input.amount);
  if (amount <= 0) return 0;
  const exists = await prisma.walletTransaction.findUnique({ where: { sourceId: input.sourceId }, select: { id: true } });
  if (exists) return 0;
  try {
    await prisma.walletTransaction.create({
      data: { ownerType: "CUSTOMER", ownerId: input.customerId, amount, kind: "AVOIR", sourceId: input.sourceId, orderId: input.orderId ?? null, note: input.note.slice(0, 200) },
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return 0; // crédité par un appel concurrent
    throw e;
  }
  await notifyAvoir(input.customerId, amount, input.reason).catch((e) => console.error("[avoir] message WhatsApp", e));
  return amount;
}

async function notifyAvoir(customerId: string, amount: number, reason: string) {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, phone: true, whatsappOptOut: true } });
  if (!c?.phone) return;
  const [code, balance, site] = await Promise.all([ensureAvoirCode(customerId), avoirBalance(customerId), getSiteUrl().catch(() => "")]);
  const first = c.name.split(/\s+/)[0] || c.name;
  const text =
    `Bonjour ${first}, ${reason}\n\n` +
    `💳 ${formatPrice(amount)} ont été ajoutés à votre avoir JAMAAL. Solde : ${formatPrice(balance)}.\n` +
    `Pour l'utiliser, saisissez votre code *${code}* dans « Code promo » au panier${site ? ` (${site.replace(/\/$/, "")}/panier)` : ""}. ` +
    `Vous pouvez aussi demander à JAMAAL de vous le verser sur Wave en répondant à ce message.`;
  await sendWhatsApp({ to: c.phone, text, kind: "client" });
}

/** Paiement d'une commande avec l'avoir (dans la transaction de création de la commande). */
export async function debitAvoirForOrder(tx: Tx, customerId: string, orderId: string, amount: number) {
  if (amount <= 0) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:CUSTOMER:${customerId}`}))`;
  const balance = await avoirBalance(customerId, tx);
  if (amount > balance) throw new Error("Le solde de votre avoir vient de changer : réessayez.");
  await tx.walletTransaction.create({
    data: { ownerType: "CUSTOMER", ownerId: customerId, amount: -amount, kind: "PAIEMENT", orderId, sourceId: `avoir-pay:${orderId}`, note: `Commande ${orderId.slice(-8).toUpperCase()}` },
  });
}

/** Commande annulée : l'avoir utilisé pour la payer revient au client (sans message, le remboursement suit). */
export async function restoreAvoirForCancelledOrder(orderId: string): Promise<number> {
  const debits = await prisma.walletTransaction.findMany({ where: { orderId, ownerType: "CUSTOMER", kind: "PAIEMENT", status: "VALIDE", amount: { lt: 0 } } });
  let total = 0;
  for (const d of debits) {
    const r = await prisma.walletTransaction.upsert({
      where: { sourceId: `annul:${d.id}` },
      update: {},
      create: { ownerType: "CUSTOMER", ownerId: d.ownerId, amount: -d.amount, kind: "ANNULATION", sourceId: `annul:${d.id}`, orderId, note: `Commande ${orderId.slice(-8).toUpperCase()} annulée : avoir rendu` },
    });
    if (r.createdAt.getTime() > Date.now() - 5_000) total += -d.amount;
  }
  return total;
}

/** Avoir utilisé pour payer une commande (FCFA). */
export async function avoirUsedForOrder(orderId: string): Promise<number> {
  const a = await prisma.walletTransaction.aggregate({ _sum: { amount: true }, where: { orderId, ownerType: "CUSTOMER", kind: "PAIEMENT", status: "VALIDE" } });
  return Math.max(0, -(a._sum.amount ?? 0));
}
