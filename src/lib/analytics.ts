"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Enregistre un événement analytics (léger, asynchrone côté appelant).
 * Pour un usage haute volumétrie, préférer un service externe (Plausible, PostHog).
 */
export async function trackEvent(input: {
  name: string;
  path?: string;
  productId?: string;
  orderId?: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name.slice(0, 64),
        path: input.path?.slice(0, 255),
        productId: input.productId,
        orderId: input.orderId,
        sessionId: input.sessionId?.slice(0, 64),
        meta: input.meta ? (JSON.parse(JSON.stringify(input.meta)) as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    // Ne jamais faire échouer l'UX pour un tracking
    console.error("[analytics]", err);
  }
}

/** Stats simples pour le dashboard admin */
export async function getAnalyticsSummary(days = 30) {
  const { requireAdmin } = await import("@/lib/actions/auth-guard");
  await requireAdmin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.analyticsEvent.groupBy({
    by: ["name"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  return events.map((e) => ({
    name: e.name,
    count: e._count._all,
  }));
}
