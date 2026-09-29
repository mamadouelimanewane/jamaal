import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

const FAST_START_THRESHOLD = 50_000;
const FAST_START_DAYS = 30;
const FAST_START_BONUS = 15_000;
const DAY_MS = 86_400_000;

export async function POST() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const now = new Date();
  const candidates = await prisma.consultant.findMany({
    where: {
      sponsorId: { not: null },
      createdAt: { lte: now },
    },
    select: { id: true, sponsorId: true, name: true, createdAt: true },
  });

  const results: { sponsoreeId: string; eligible: boolean; ca: number; expired: boolean }[] = [];

  for (const consultant of candidates) {
    const sponsorId = consultant.sponsorId;
    if (!sponsorId) continue;

    const existing = await prisma.fastStartBonus.findUnique({
      where: { sponsorId_sponsoreeId: { sponsorId, sponsoreeId: consultant.id } },
    });
    if (existing) continue;

    const windowEnd = new Date(consultant.createdAt.getTime() + FAST_START_DAYS * DAY_MS);
    const through = windowEnd < now ? windowEnd : now;
    const [sales, refunds] = await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          consultantId: consultant.id,
          status: { not: "ANNULEE" },
          createdAt: { gte: consultant.createdAt, lte: through },
        },
      }),
      prisma.return.aggregate({
        _sum: { amount: true },
        where: {
          status: "REMBOURSE",
          order: {
            consultantId: consultant.id,
            createdAt: { gte: consultant.createdAt, lte: through },
          },
        },
      }),
    ]);

    const revenue = Math.max(0, (sales._sum.total ?? 0) - (refunds._sum.amount ?? 0));
    const eligible = revenue >= FAST_START_THRESHOLD;
    const expired = now >= windowEnd && !eligible;
    results.push({ sponsoreeId: consultant.id, eligible, ca: revenue, expired });

    if (eligible || expired) {
      await prisma.fastStartBonus.createMany({
        data: [{
          sponsorId,
          sponsoreeId: consultant.id,
          amount: eligible ? FAST_START_BONUS : 0,
          status: eligible ? "PENDING" : "EXPIRED",
        }],
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
