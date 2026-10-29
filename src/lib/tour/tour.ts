/**
 * Tournée d'un livreur : ordre de passage conseillé, itinéraire routier, trace récente.
 * Fichier serveur (utilisé par /api/livreur/tour et la carte de la flotte).
 */
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { isValidPoint, type DeliveryStatus, type LatLng } from "@/lib/delivery";
import { isFresh, orderStops } from "@/lib/geo-track";
import { roadRoute, type RoadRoute } from "@/lib/routing";
import { trailBetween } from "@/lib/livreur-tracking";

export type TourStop = LatLng & { id: string; n: number; name: string; address: string | null; status: DeliveryStatus; approx: boolean; km: number | null; minutes: number | null };
export type Tour = {
  me: (LatLng & { at: string; accuracy: number | null }) | null;
  live: boolean;
  depot: LatLng & { label: string };
  /** Passage au dépôt nécessaire (colis pas encore récupérés). */
  pickup: boolean;
  stops: TourStop[];
  unlocated: { id: string; name: string; address: string | null }[];
  route: RoadRoute | null;
  trail: LatLng[];
};

const ACTIVE = ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"];

export async function livreurTour(livreurId: string, opts: { withRoute?: boolean; trailMinutes?: number } = {}): Promise<Tour> {
  const [model, livreur, orders] = await Promise.all([
    getBusinessModel(),
    prisma.livreur.findUnique({ where: { id: livreurId }, select: { lastLat: true, lastLng: true, lastSeenAt: true, lastAccuracy: true } }),
    prisma.order.findMany({
      where: {
        livreurId,
        status: { not: "ANNULEE" },
        deliveryMode: "LIVRAISON_JAMAAL",
        OR: [{ deliveryStatus: { in: ACTIVE } }, { deliveryStatus: null, status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, customerName: true, deliveryContactName: true, address: true, deliveryPlace: true, deliveryLat: true, deliveryLng: true, deliveryStatus: true, deliveryApprox: true },
    }),
  ]);
  const depot = { lat: model.depotLat, lng: model.depotLng, label: model.depotLabel };
  const live = isFresh(livreur?.lastSeenAt);
  const me = livreur?.lastLat != null && livreur.lastLng != null && livreur.lastSeenAt ? { lat: livreur.lastLat, lng: livreur.lastLng, at: livreur.lastSeenAt.toISOString(), accuracy: livreur.lastAccuracy } : null;

  type S = Omit<TourStop, "n" | "km" | "minutes">;
  const located: S[] = [];
  const unlocated: Tour["unlocated"] = [];
  for (const o of orders) {
    const p = { lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN };
    const name = o.deliveryContactName ?? o.customerName;
    const address = o.deliveryPlace ?? o.address;
    if (isValidPoint(p)) located.push({ id: o.id, name, address, ...p, status: (o.deliveryStatus ?? "ASSIGNEE") as DeliveryStatus, approx: o.deliveryApprox });
    else unlocated.push({ id: o.id, name, address });
  }

  const start: LatLng = me && live ? me : depot;
  const enRoute = orderStops(start, located.filter((s) => s.status === "EN_ROUTE"));
  const after1 = enRoute.at(-1) ?? start;
  const picked = orderStops(after1, located.filter((s) => s.status === "RECUPEREE"));
  const toPick = located.filter((s) => s.status === "ASSIGNEE");
  const pickup = toPick.length > 0;
  const fromDepot = orderStops(depot, toPick);

  const waypoints: LatLng[] = [start, ...enRoute, ...picked, ...(pickup ? [depot] : []), ...fromDepot];
  const route = opts.withRoute !== false && waypoints.length >= 2 ? await roadRoute(waypoints) : null;

  // Tronçons → arrêts (le passage au dépôt est un tronçon sans arrêt client).
  const legs = route?.legs ?? [];
  let cumKm = 0;
  let cumMin = 0;
  let legIndex = 0;
  const stops: TourStop[] = [];
  const pushUntil = (s: S, n: number) => {
    const leg = legs[legIndex++];
    if (leg) {
      cumKm += leg.km;
      cumMin += leg.minutes;
    }
    stops.push({ ...s, n, km: leg ? Math.round(cumKm * 10) / 10 : null, minutes: leg ? cumMin : null });
  };
  let n = 1;
  for (const s of [...enRoute, ...picked]) pushUntil(s, n++);
  if (pickup) {
    const leg = legs[legIndex++];
    if (leg) {
      cumKm += leg.km;
      cumMin += leg.minutes + 5; // temps de récupération au dépôt
    }
  }
  for (const s of fromDepot) pushUntil(s, n++);

  const since = new Date(Date.now() - (opts.trailMinutes ?? 90) * 60_000);
  const trail = await trailBetween(livreurId, since, new Date(), 300);
  return { me, live, depot, pickup, stops, unlocated, route, trail };
}
