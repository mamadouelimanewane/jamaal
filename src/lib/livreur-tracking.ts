/**
 * Suivi GPS des livreurs (serveur) : enregistrement des positions, trace d'une livraison,
 * message « votre livreur arrive », purge des anciennes traces.
 */
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getSiteUrl } from "@/lib/site-url";
import { isValidPoint, type LatLng } from "@/lib/delivery";
import { ARRIVING_M, PING_RETENTION_DAYS, distanceM, simplifyTrail } from "@/lib/geo-track";

export type FixInput = LatLng & { accuracy?: number | null; speed?: number | null; heading?: number | null };

/** Enregistre une position du livreur (dernière position + trace) et prévient les clients tout proches. */
export async function recordPosition(livreurId: string, fix: FixInput): Promise<{ saved: boolean; arriving: number }> {
  if (!isValidPoint(fix)) return { saved: false, arriving: 0 };
  const now = new Date();
  const last = await prisma.livreurPing.findFirst({ where: { livreurId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const tooSoon = !!last && now.getTime() - last.createdAt.getTime() < 4_000;
  const data = { lastLat: fix.lat, lastLng: fix.lng, lastSeenAt: now, lastAccuracy: fix.accuracy ?? null, lastSpeed: fix.speed ?? null, lastHeading: fix.heading ?? null };
  await prisma.$transaction([
    prisma.livreur.update({ where: { id: livreurId }, data }),
    ...(tooSoon ? [] : [prisma.livreurPing.create({ data: { livreurId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy ?? null, speed: fix.speed ?? null, heading: fix.heading ?? null } })]),
  ]);
  const arriving = await notifyArrivals(livreurId, fix).catch((e) => {
    console.error("[gps] arrivée", e);
    return 0;
  });
  return { saved: !tooSoon, arriving };
}

/** Client prévenu une seule fois quand son livreur (en route) est à moins de 400 m. */
export async function notifyArrivals(livreurId: string, here: LatLng): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { livreurId, deliveryStatus: "EN_ROUTE", arrivingNotifiedAt: null, deliveryLat: { not: null }, deliveryLng: { not: null } },
    select: { id: true, deliveryLat: true, deliveryLng: true, customerName: true, customerPhone: true, deliveryContactName: true, deliveryContactPhone: true, deliveryTarget: true, livreur: { select: { name: true } } },
  });
  let sent = 0;
  for (const o of orders) {
    if (distanceM(here, { lat: o.deliveryLat!, lng: o.deliveryLng! }) > ARRIVING_M) continue;
    const claimed = await prisma.order.updateMany({ where: { id: o.id, arrivingNotifiedAt: null }, data: { arrivingNotifiedAt: new Date() } });
    if (!claimed.count) continue;
    const phone = o.deliveryContactPhone ?? o.customerPhone;
    const name = o.deliveryContactName ?? o.customerName;
    if (phone) {
      const site = await getSiteUrl().catch(() => "");
      await sendWhatsApp({
        to: phone,
        kind: o.deliveryTarget === "VENDEUR" ? "reseller" : "client",
        text: `Bonjour ${name}, ${o.livreur?.name ?? "votre livreur"} arrive dans quelques minutes avec votre commande JAMAAL 🛵. Préparez votre code de livraison.`,
        ...(site ? { cta: { label: "Voir sur la carte", url: `${site.replace(/\/$/, "")}/suivi/${o.id}` } } : {}),
      }).catch(() => {});
    }
    sent += 1;
  }
  return sent;
}

/** Trace du livreur sur une période (allégée). */
export async function trailBetween(livreurId: string, from: Date, to: Date = new Date(), max = 400): Promise<LatLng[]> {
  const rows = await prisma.livreurPing.findMany({
    where: { livreurId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    take: 3000,
    select: { lat: true, lng: true, accuracy: true },
  });
  // Points trop imprécis (> 150 m) écartés : ils dessinent des zigzags.
  return simplifyTrail(rows.filter((r) => r.accuracy == null || r.accuracy <= 150), 15, max);
}

/** Trace d'une livraison : depuis la récupération du colis jusqu'à la remise (ou maintenant). */
export async function orderTrail(orderId: string, max = 400): Promise<LatLng[]> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { livreurId: true, deliveredAt: true, deliveryEvents: { where: { status: { in: ["RECUPEREE", "EN_ROUTE", "LIVREE", "ECHEC"] } }, orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true, livreurId: true } } },
  });
  const start = o?.deliveryEvents.find((e) => e.status === "RECUPEREE" || e.status === "EN_ROUTE");
  const livreurId = start?.livreurId ?? o?.livreurId;
  if (!o || !start || !livreurId) return [];
  const end = o.deliveryEvents.find((e) => (e.status === "LIVREE" || e.status === "ECHEC") && e.createdAt > start.createdAt)?.createdAt ?? o.deliveredAt ?? new Date();
  return trailBetween(livreurId, start.createdAt, end, max);
}

/** Purge quotidienne de la trace GPS (au-delà de 30 jours). */
export async function purgeOldPings(): Promise<number> {
  const r = await prisma.livreurPing.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PING_RETENTION_DAYS * 86_400_000) } } });
  return r.count;
}
