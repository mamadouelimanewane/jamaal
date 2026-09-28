"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import {
  pointsEarnedFromAmount,
  LOYALTY_REDEEM_MIN_POINTS,
  redeemValue,
} from "@/lib/loyalty";

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

/** Crédite des points après une commande payée / livrée. */
export async function earnLoyaltyForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, total: true, customerPhone: true, customerName: true },
  });
  if (!order?.customerPhone) return null;

  const phone = normalizePhone(order.customerPhone);
  const points = pointsEarnedFromAmount(order.total);
  if (points <= 0) return null;

  const account = await prisma.loyaltyAccount.upsert({
    where: { phone },
    create: {
      phone,
      name: order.customerName,
      points,
      lifetime: points,
    },
    update: {
      points: { increment: points },
      lifetime: { increment: points },
      name: order.customerName,
    },
  });

  await prisma.loyaltyEvent.create({
    data: {
      accountId: account.id,
      type: "EARN_ORDER",
      points,
      orderId: order.id,
      note: `Commande ${order.id.slice(-8).toUpperCase()}`,
    },
  });

  return { phone, points, balance: account.points };
}

/** Consulter le solde par téléphone (page compte / suivi). */
export async function getLoyaltyBalance(phone: string) {
  const p = normalizePhone(phone);
  if (!p) return null;
  const account = await prisma.loyaltyAccount.findUnique({ where: { phone: p } });
  if (!account) return { phone: p, points: 0, lifetime: 0 };
  return {
    phone: account.phone,
    points: account.points,
    lifetime: account.lifetime,
    name: account.name,
  };
}

/** Échanger des lots de points (admin ou flux futur checkout). */
export async function redeemLoyaltyPoints(phone: string, lots: number) {
  await requireAdmin();
  if (lots < 1) throw new Error("Nombre de lots invalide");

  const p = normalizePhone(phone);
  const account = await prisma.loyaltyAccount.findUnique({ where: { phone: p } });
  if (!account) throw new Error("Compte fidélité introuvable");

  const cost = lots * LOYALTY_REDEEM_MIN_POINTS;
  if (account.points < cost) throw new Error("Solde insuffisant");

  const value = redeemValue(lots);
  const updated = await prisma.loyaltyAccount.update({
    where: { id: account.id },
    data: { points: { decrement: cost } },
  });

  await prisma.loyaltyEvent.create({
    data: {
      accountId: account.id,
      type: "REDEEM",
      points: -cost,
      note: `Échange ${lots} lot(s) = ${value} FCFA`,
    },
  });

  revalidatePath("/admin");
  return { points: updated.points, valueFcfa: value };
}
