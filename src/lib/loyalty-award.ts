import { prisma } from "@/lib/prisma";
import { pointsEarnedFromAmount } from "@/lib/loyalty";

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

/** Crédite les points d'une commande une seule fois (idempotent par commande). */
export async function awardLoyaltyForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, total: true, customerPhone: true, customerName: true },
  });
  if (!order?.customerPhone) return null;

  const phone = normalizePhone(order.customerPhone);
  const points = pointsEarnedFromAmount(order.total);
  if (points <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const already = await tx.loyaltyEvent.findFirst({
      where: { orderId: order.id, type: "EARN_ORDER" },
      select: { id: true },
    });
    if (already) return null;

    const account = await tx.loyaltyAccount.upsert({
      where: { phone },
      create: { phone, name: order.customerName, points, lifetime: points },
      update: {
        points: { increment: points },
        lifetime: { increment: points },
        name: order.customerName,
      },
    });
    await tx.loyaltyEvent.create({
      data: {
        accountId: account.id,
        type: "EARN_ORDER",
        points,
        orderId: order.id,
        note: `Commande ${order.id.slice(-8).toUpperCase()}`,
      },
    });
    return { phone, points, balance: account.points };
  });
}
