"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import {
  LOYALTY_REDEEM_MIN_POINTS,
  redeemValue,
} from "@/lib/loyalty";

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

/** Consulter le solde par téléphone (page compte / suivi). */
export async function getLoyaltyBalance(phone: string) {
  await requireAdmin();
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
  // Décrément conditionnel : pas de solde négatif en cas d'appels concurrents
  const res = await prisma.loyaltyAccount.updateMany({
    where: { id: account.id, points: { gte: cost } },
    data: { points: { decrement: cost } },
  });
  if (res.count === 0) throw new Error("Solde insuffisant");
  const updated = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });

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
