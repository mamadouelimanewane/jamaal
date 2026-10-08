"use server";

import { getBusinessModel } from "@/lib/business-model-store";
import { isValidPoint, quoteDelivery, type DeliveryQuote } from "@/lib/delivery";

export type CartDeliveryInfo = { depot: { lat: number; lng: number; label: string }; freeAbove: number };

/** Dépôt et règles affichés au panier (aucune donnée sensible). */
export async function getCartDeliveryInfo(): Promise<CartDeliveryInfo> {
  const m = await getBusinessModel();
  return { depot: { lat: m.depotLat, lng: m.depotLng, label: m.depotLabel }, freeAbove: m.deliveryFreeAbove };
}

/** Devis de livraison affiché au panier. Le montant est recalculé à la création de la commande. */
export async function quoteDeliveryForCart(lat: number, lng: number, productsTotal: number): Promise<DeliveryQuote> {
  const point = { lat: Number(lat), lng: Number(lng) };
  if (!isValidPoint(point)) return { ok: false, distanceKm: 0, error: "Position invalide." };
  const total = Number.isFinite(productsTotal) && productsTotal > 0 ? productsTotal : 0;
  return quoteDelivery(point, total, await getBusinessModel());
}
