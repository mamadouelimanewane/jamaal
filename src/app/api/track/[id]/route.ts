import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { DELIVERY_LABELS, etaMinutes, isValidPoint, roadKm, type DeliveryStatus } from "@/lib/delivery";
import { roadRoute } from "@/lib/routing";
import { orderTrail } from "@/lib/livreur-tracking";

/**
 * Suivi public d'une commande (l'identifiant, non devinable, sert de clé d'accès).
 * Ne renvoie ni le code de livraison ni les coordonnées du client autres que le point de livraison.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      deliveryMode: true,
      deliveryStatus: true,
      deliveryLat: true,
      deliveryLng: true,
      deliveredAt: true,
      updatedAt: true,
      livreur: { select: { name: true, lastLat: true, lastLng: true, lastSeenAt: true, lastHeading: true, lastAccuracy: true } },
      deliveryEvents: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true, note: true } },
    },
  });
  if (!order) return Response.json({ error: "not_found" }, { status: 404 });

  const model = await getBusinessModel();
  const destination = isValidPoint({ lat: order.deliveryLat ?? NaN, lng: order.deliveryLng ?? NaN }) ? { lat: order.deliveryLat!, lng: order.deliveryLng! } : null;
  const status = (order.deliveryStatus ?? null) as DeliveryStatus | null;

  // Position du livreur montrée seulement pendant la tournée, et si elle est récente (moins de 30 min).
  const fresh = order.livreur?.lastSeenAt && Date.now() - order.livreur.lastSeenAt.getTime() < 30 * 60_000;
  const onTheWay = status === "RECUPEREE" || status === "EN_ROUTE";
  const livreurPos = onTheWay && fresh && order.livreur?.lastLat != null && order.livreur?.lastLng != null ? { lat: order.livreur.lastLat, lng: order.livreur.lastLng } : null;
  // Itinéraire par la route : livreur → client pendant la tournée, sinon dépôt → client (prévu).
  const live = status !== "LIVREE" && status !== "ECHEC" && destination;
  const from = livreurPos ?? (onTheWay ? null : { lat: model.depotLat, lng: model.depotLng });
  const road = live && from ? await roadRoute([from, destination]).catch(() => null) : null;
  const remainingKm = livreurPos && destination ? (road?.km ?? roadKm(livreurPos, destination)) : null;
  const eta = livreurPos && destination ? (road?.minutes ?? (remainingKm != null ? etaMinutes(remainingKm) : null)) : null;
  const trail = onTheWay ? await orderTrail(id, 250).catch(() => []) : [];

  return Response.json(
    {
      status: order.status,
      deliveryMode: order.deliveryMode,
      deliveryStatus: status,
      deliveryLabel: status ? DELIVERY_LABELS[status] : null,
      updatedAt: order.updatedAt,
      deliveredAt: order.deliveredAt,
      depot: { lat: model.depotLat, lng: model.depotLng, label: model.depotLabel },
      destination,
      livreur: order.livreur
        ? { name: order.livreur.name, lat: livreurPos?.lat ?? null, lng: livreurPos?.lng ?? null, lastSeenAt: order.livreur.lastSeenAt, heading: livreurPos ? order.livreur.lastHeading : null, accuracy: livreurPos ? order.livreur.lastAccuracy : null }
        : null,
      remainingKm,
      etaMinutes: eta,
      route: road ? { path: road.path, planned: !livreurPos, source: road.source } : null,
      trail: trail.map((p) => [p.lat, p.lng]),
      events: order.deliveryEvents.map((e) => ({ status: e.status, label: DELIVERY_LABELS[e.status as DeliveryStatus] ?? e.status, at: e.createdAt, note: e.status === "ECHEC" ? e.note : null })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
