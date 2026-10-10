/** Données de gestion autour de la comptabilité : à rembourser, factures à payer, prévisionnel. Fichier serveur. */
import { prisma } from "../prisma";
import { balanceOf } from "../reservation";
import { cashReceived } from "./posting";

/** Commandes annulées dont l'argent a été reçu et pas encore rendu au client. */
export async function refundsOwed() {
  const orders = await prisma.order.findMany({
    where: { status: "ANNULEE", refundedAt: null, OR: [{ paymentStatus: "PAYE" }, { depositPaidAt: { not: null } }] },
    select: { id: true, customerName: true, customerPhone: true, total: true, deliveryFee: true, status: true, paymentMethod: true, paymentStatus: true, paidAt: true, deliveredAt: true, updatedAt: true, createdAt: true, isReservation: true, depositAmount: true, depositPaidAt: true, refundedAt: true, refundChannel: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return orders
    .map((o) => ({ ...o, owed: cashReceived({ ...o, cancelledAt: null }) + (o.paymentMethod === "WALLET" && o.paymentStatus === "PAYE" ? o.total : 0) }))
    .filter((o) => o.owed > 0);
}

export async function unpaidBills() {
  return prisma.expense.findMany({
    where: { paid: false },
    orderBy: [{ dueDate: "asc" }, { date: "asc" }],
    select: { id: true, label: true, amount: true, supplier: true, date: true, dueDate: true, account: true, reference: true },
  });
}

/** Ce qui doit rentrer et sortir dans les prochaines semaines. */
export async function cashForecast() {
  const [cod, reservations, withdrawals, bills, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] }, paymentMethod: "A_LA_LIVRAISON", paymentStatus: { not: "PAYE" }, OR: [{ isReservation: false }, { reservationStatus: "DISPONIBLE" }] },
      select: { total: true, isReservation: true, depositAmount: true, depositPaidAt: true },
    }),
    prisma.order.findMany({
      where: { isReservation: true, reservationStatus: { in: ["RESERVEE", "DISPONIBLE"] }, paymentMethod: { not: "A_LA_LIVRAISON" }, status: { not: "ANNULEE" } },
      select: { total: true, depositAmount: true },
    }),
    prisma.walletTransaction.aggregate({ _sum: { amount: true }, _count: true, where: { kind: "RETRAIT", status: "EN_ATTENTE" } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true, where: { paid: false } }),
    refundsOwed(),
  ]);
  return {
    codExpected: cod.reduce((s, o) => s + balanceOf(o), 0),
    codCount: cod.length,
    reservationsExpected: reservations.reduce((s, o) => s + Math.max(0, o.total - o.depositAmount), 0),
    reservationsCount: reservations.length,
    pendingWithdrawals: -(withdrawals._sum.amount ?? 0),
    pendingWithdrawalsCount: withdrawals._count,
    unpaidBills: bills._sum.amount ?? 0,
    unpaidBillsCount: bills._count,
    refundsOwed: refunds.reduce((s, r) => s + r.owed, 0),
    refundsCount: refunds.length,
  };
}
