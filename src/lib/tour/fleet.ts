/**
 * Flotte en direct pour l'administrateur : positions des livreurs, trajets récents, arrêts en cours,
 * livraisons à attribuer avec le livreur disponible le plus proche. Fichier serveur.
 */
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { haversineKm, isValidPoint, roadKm, type DeliveryStatus, type LatLng } from "@/lib/delivery";
import { isFresh } from "@/lib/geo-track";
import { trailBetween } from "@/lib/livreur-tracking";
import { LIVREUR_ACTIVE } from "@/lib/livreur-signup";

export type FleetLivreur = {
  id: string; name: string; phone: string; vehicle: string | null;
  pos: (LatLng & { at: string; accuracy: number | null; heading: number | null; speed: number | null }) | null;
  live: boolean;
  stops: (LatLng & { id: string; name: string; status: DeliveryStatus })[];
  trail: [number, number][];
};
export type FleetPending = LatLng & { id: string; name: string; address: string | null; status: DeliveryStatus; nearest: { id: string; name: string; km: number } | null };
export type Fleet = { depot: LatLng & { label: string }; livreurs: FleetLivreur[]; pending: FleetPending[]; at: string };

export async function fleetSnapshot(): Promise<Fleet> {
  const [model, livreurs, pendingOrders] = await Promise.all([
    getBusinessModel(),
    prisma.livreur.findMany({
      where: { active: true, status: LIVREUR_ACTIVE },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, phone: true, vehicle: true, lastLat: true, lastLng: true, lastSeenAt: true, lastAccuracy: true, lastHeading: true, lastSpeed: true,
        orders: {
          where: { status: { not: "ANNULEE" }, deliveryMode: "LIVRAISON_JAMAAL", deliveryStatus: { in: ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"] } },
          select: { id: true, customerName: true, deliveryContactName: true, deliveryLat: true, deliveryLng: true, deliveryStatus: true },
        },
      },
    }),
    prisma.order.findMany({
      where: { status: { not: "ANNULEE" }, deliveryMode: "LIVRAISON_JAMAAL", OR: [{ deliveryStatus: { in: ["A_PREPARER", "ECHEC"] } }, { deliveryStatus: null, livreurId: null }] },
      orderBy: { createdAt: "asc" },
      take: 60,
      select: { id: true, customerName: true, deliveryContactName: true, address: true, deliveryPlace: true, deliveryLat: true, deliveryLng: true, deliveryStatus: true },
    }),
  ]);

  const since = new Date(Date.now() - 45 * 60_000);
  const out: FleetLivreur[] = await Promise.all(
    livreurs.map(async (l) => {
      const live = isFresh(l.lastSeenAt);
      const pos = l.lastLat != null && l.lastLng != null && l.lastSeenAt ? { lat: l.lastLat, lng: l.lastLng, at: l.lastSeenAt.toISOString(), accuracy: l.lastAccuracy, heading: l.lastHeading, speed: l.lastSpeed } : null;
      const trail = live ? (await trailBetween(l.id, since, new Date(), 150)).map((p) => [p.lat, p.lng] as [number, number]) : [];
      const stops = l.orders
        .filter((o) => isValidPoint({ lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN }))
        .map((o) => ({ id: o.id, name: o.deliveryContactName ?? o.customerName, lat: o.deliveryLat!, lng: o.deliveryLng!, status: o.deliveryStatus as DeliveryStatus }));
      return { id: l.id, name: l.name, phone: l.phone, vehicle: l.vehicle, pos, live, stops, trail };
    })
  );

  const available = out.filter((l) => l.live && l.pos);
  const pending: FleetPending[] = pendingOrders
    .filter((o) => isValidPoint({ lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN }))
    .map((o) => {
      const p = { lat: o.deliveryLat!, lng: o.deliveryLng! };
      let nearest: FleetPending["nearest"] = null;
      for (const l of available) {
        // Un livreur déjà chargé passe derrière : +1 km par livraison en cours.
        const score = haversineKm(l.pos!, p) + l.stops.length;
        if (!nearest || score < nearest.km + 0.0001) nearest = { id: l.id, name: l.name, km: score };
      }
      if (nearest) nearest = { ...nearest, km: roadKm(available.find((l) => l.id === nearest!.id)!.pos!, p) };
      return { id: o.id, name: o.deliveryContactName ?? o.customerName, address: o.deliveryPlace ?? o.address, ...p, status: (o.deliveryStatus ?? "A_PREPARER") as DeliveryStatus, nearest };
    });

  return { depot: { lat: model.depotLat, lng: model.depotLng, label: model.depotLabel }, livreurs: out, pending, at: new Date().toISOString() };
}
