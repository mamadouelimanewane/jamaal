"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

const EVENT_NAMES = new Set(["page_view", "product_view", "add_to_cart", "cart_open", "cart_view", "order_created", "payment_started", "payment_confirmed"]);

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
    if (!EVENT_NAMES.has(input.name)) return;
    if (input.name === "payment_confirmed" && input.orderId) {
      const existing = await prisma.analyticsEvent.findFirst({ where: { name: input.name, orderId: input.orderId }, select: { id: true } });
      if (existing) return;
    }
    const linkedSession = input.sessionId || (input.orderId
      ? (await prisma.analyticsEvent.findFirst({ where: { name: "order_created", orderId: input.orderId }, select: { sessionId: true } }))?.sessionId ?? undefined
      : undefined);
    let consultantId: string | undefined;
    let source = "SITE";
    try {
      const slug = (await cookies()).get("jamaal_ref")?.value;
      if (slug) {
        const referrer = await prisma.consultant.findUnique({ where: { slug }, select: { id: true } });
        consultantId = referrer?.id;
        if (consultantId) source = "VENDEUR";
      }
    } catch { /* Appel automatique sans contexte HTTP : on utilisera les données de la commande. */ }
    if (input.orderId) {
      const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { consultantId: true, channel: true } });
      if (order) {
        consultantId = order.consultantId ?? consultantId;
        source = order.channel;
      }
    }
    const metadata = input.meta ? JSON.stringify(input.meta) : "";
    const safeSession = linkedSession && /^[a-z0-9-]{1,64}$/i.test(linkedSession) ? linkedSession : undefined;
    await prisma.analyticsEvent.create({
      data: {
        name: input.name.slice(0, 64),
        path: input.path?.startsWith("/") ? input.path.split("?")[0]?.slice(0, 255) : undefined,
        productId: input.productId?.slice(0, 100),
        consultantId,
        source: source.slice(0, 32),
        orderId: input.orderId?.slice(0, 100),
        sessionId: safeSession,
        meta: metadata && metadata.length <= 500 ? (JSON.parse(metadata) as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    // Ne jamais faire échouer l'UX pour un tracking
    console.error("[analytics]", err);
  }
}

/** Nombre d'événements et de sessions par étape, limité aux événements autorisés. */
export async function getAnalyticsFunnel(days = 30, filters: { productId?: string; consultantId?: string; source?: string } = {}) {
  const { requireAdmin } = await import("@/lib/actions/auth-guard");
  await requireAdmin("statistiques", "read");
  const since = new Date(Date.now() - Math.max(1, Math.min(180, days)) * 86_400_000);
  let sessionIds: string[] | undefined;
  const sessionFilters: Prisma.AnalyticsEventWhereInput[] = [];
  if (filters.productId) sessionFilters.push({ productId: filters.productId, name: { in: ["product_view", "add_to_cart"] } });
  if (filters.consultantId) sessionFilters.push({ consultantId: filters.consultantId });
  if (filters.source) sessionFilters.push({ source: filters.source });
  if (sessionFilters.length) {
    const sets = await Promise.all(sessionFilters.map(async (filter) => {
      const sessions = await prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since }, sessionId: { not: null }, ...filter }, select: { sessionId: true }, distinct: ["sessionId"], take: 20_000 });
      return new Set(sessions.flatMap((row) => row.sessionId ? [row.sessionId] : []));
    }));
    const seed = [...sets[0]];
    sessionIds = seed.filter((id) => sets.every((set) => set.has(id)));
  }
  const rows = sessionIds?.length === 0 ? [] : await prisma.analyticsEvent.groupBy({
    by: ["name", "sessionId"],
    where: { createdAt: { gte: since }, sessionId: { not: null }, name: { in: [...EVENT_NAMES] }, ...(sessionIds ? { sessionId: { in: sessionIds } } : {}) },
    _count: { _all: true },
  });
  const order = ["product_view", "add_to_cart", "cart_open", "cart_view", "order_created", "payment_started", "payment_confirmed"];
  const labels: Record<string, string> = {
    product_view: "Fiches produit vues",
    add_to_cart: "Ajouts au panier",
    cart_open: "Panier ouvert depuis le site",
    cart_view: "Panier consulté",
    order_created: "Commandes créées",
    payment_started: "Paiements démarrés",
    payment_confirmed: "Paiements confirmés (dont paiement à la livraison)",
  };
  const grouped = new Map<string, { events: number; sessions: Set<string> }>();
  for (const row of rows) {
    const value = grouped.get(row.name) ?? { events: 0, sessions: new Set<string>() };
    value.events += row._count._all;
    if (row.sessionId) value.sessions.add(row.sessionId);
    grouped.set(row.name, value);
  }
  const first = grouped.get("product_view")?.sessions.size ?? 0;
  return order.map((name) => {
    const value = grouped.get(name) ?? { events: 0, sessions: new Set<string>() };
    return { name, label: labels[name], events: value.events, sessions: value.sessions.size, rate: first ? Math.round((value.sessions.size / first) * 100) : 0 };
  });
}

/** Stats simples pour le dashboard admin */
export async function getAnalyticsSummary(days = 30) {
  const { requireAdmin } = await import("@/lib/actions/auth-guard");
  await requireAdmin("statistiques", "read");
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
