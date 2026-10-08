/**
 * Module livraison : calculs purs (utilisables côté serveur et dans le navigateur).
 * Les montants faisant foi sont toujours recalculés côté serveur.
 */
import type { BusinessModel } from "./business-model";

export type LatLng = { lat: number; lng: number };

/** Étapes d'une livraison, dans l'ordre. */
export const DELIVERY_STEPS = ["A_PREPARER", "ASSIGNEE", "RECUPEREE", "EN_ROUTE", "LIVREE"] as const;
export type DeliveryStatus = (typeof DELIVERY_STEPS)[number] | "ECHEC";

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  A_PREPARER: "En préparation",
  ASSIGNEE: "Livreur attribué",
  RECUPEREE: "Colis récupéré",
  EN_ROUTE: "En route",
  LIVREE: "Livrée",
  ECHEC: "Livraison impossible",
};

/** Coefficient entre la distance à vol d'oiseau et la distance par la route (Dakar). */
export const ROAD_FACTOR = 1.35;
/** Vitesse moyenne d'un livreur en ville (km/h), pour l'heure d'arrivée estimée. */
export const AVERAGE_SPEED_KMH = 22;

/** Distance à vol d'oiseau (km), formule de haversine. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance estimée par la route (km, une décimale). */
export function roadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * ROAD_FACTOR * 10) / 10;
}

/** Durée estimée (minutes) pour parcourir une distance routière. */
export function etaMinutes(km: number): number {
  return Math.max(3, Math.round((km / AVERAGE_SPEED_KMH) * 60));
}

export function isValidPoint(p: Partial<LatLng> | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180 && !(p.lat === 0 && p.lng === 0);
}

export type DeliveryQuote =
  | { ok: true; distanceKm: number; fee: number; free: boolean; livreurShare: number }
  | { ok: false; distanceKm: number; error: string };

/** Frais de livraison pour un point de livraison et un montant de produits. */
export function quoteDelivery(point: LatLng, productsTotal: number, model: BusinessModel): DeliveryQuote {
  const depot = { lat: model.depotLat, lng: model.depotLng };
  const distanceKm = roadKm(depot, point);
  if (model.deliveryMaxKm > 0 && distanceKm > model.deliveryMaxKm) {
    return { ok: false, distanceKm, error: `Adresse trop éloignée (${distanceKm.toLocaleString("fr-FR")} km, maximum ${model.deliveryMaxKm} km). Choisissez le retrait chez votre consultant ou contactez-nous.` };
  }
  const free = model.deliveryFreeAbove > 0 && productsTotal >= model.deliveryFreeAbove;
  const extraKm = Math.max(0, distanceKm - model.deliveryIncludedKm);
  const raw = model.deliveryBaseFee + extraKm * model.deliveryPerKm;
  const step = model.priceRounding > 0 ? model.priceRounding : 100;
  const fee = free ? 0 : Math.round(raw / step) * step;
  // Livraison offerte : le livreur reste payé sur le tarif normal (pris sur la marge JAMAAL).
  const livreurShare = Math.round(((free ? Math.round(raw / step) * step : fee) * model.livreurSharePct) / 100);
  return { ok: true, distanceKm, fee, free, livreurShare };
}

/** Code de remise à 4 chiffres, donné par le client au livreur pour confirmer la livraison. */
export function newDeliveryCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10_000;
  return n.toString().padStart(4, "0");
}

/** Lien d'itinéraire Google Maps vers un point (ouvre l'application sur téléphone). */
export function directionsUrl(point: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
}
