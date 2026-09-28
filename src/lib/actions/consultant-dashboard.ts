"use server";

import { prisma } from "@/lib/prisma";
import { requireConsultantProfile } from "./auth-guard";
import { getConsultantCommission } from "@/lib/commission";

export async function getConsultantDashboard() {
  const { consultant } = await requireConsultantProfile();

  const [commission, recentOrders, team, orderCount] = await Promise.all([
    getConsultantCommission(consultant.id),
    prisma.order.findMany({
      where: { consultantId: consultant.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        customerName: true,
        total: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.consultant.findMany({
      where: { sponsorId: consultant.id, active: true },
      select: {
        id: true,
        name: true,
        city: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.order.count({
      where: { consultantId: consultant.id, status: { not: "ANNULEE" } },
    }),
  ]);

  return {
    consultant: {
      id: consultant.id,
      name: consultant.name,
      city: consultant.city,
      whatsapp: consultant.whatsapp,
      slug: (consultant as { slug?: string | null }).slug ?? null,
    },
    commission,
    recentOrders,
    team,
    orderCount,
    personalLink: (consultant as { slug?: string | null }).slug
      ? `/c/${(consultant as { slug?: string | null }).slug}`
      : null,
  };
}
