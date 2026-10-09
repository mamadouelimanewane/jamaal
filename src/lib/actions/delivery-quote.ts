"use server";

import { getBusinessModel } from "@/lib/business-model-store";
import { headers } from "next/headers";
import { isValidPoint, quoteDelivery, type DeliveryQuote } from "@/lib/delivery";
import { isShortMapLink, parseLocation } from "@/lib/geo-parse";
import { expandShortLink, geocodeFuzzy } from "@/lib/geocode";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

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

export type LocateResult =
  | { ok: true; lat: number; lng: number; approx: boolean; label: string }
  | { ok: false; error: string };

/**
 * Position à partir d'un texte collé : coordonnées, lien Google Maps / WhatsApp (même court),
 * Plus Code, ou à défaut adresse approximative (« Sacré-Cœur 3 près de la pharmacie »).
 */
export async function locateFromText(text: string): Promise<LocateResult> {
  const t = String(text ?? "").trim().slice(0, 500);
  if (t.length < 3) return { ok: false, error: "Collez un lien de localisation ou écrivez le quartier." };
  const h = await headers();
  const limited = await rateLimit(`geo:${clientIpFromHeaders(h)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Trop de recherches, patientez une minute." };

  const exact = parseLocation(t);
  if (exact) return { ok: true, lat: exact.lat, lng: exact.lng, approx: false, label: exact.source === "plus-code" ? "Plus Code" : "Position partagée" };
  const link = t.match(/https?:\/\/\S+/)?.[0];
  if (link && isShortMapLink(link)) {
    const long = await expandShortLink(link);
    const p = long ? parseLocation(long) : null;
    if (p) return { ok: true, lat: p.lat, lng: p.lng, approx: false, label: "Position partagée" };
  }
  const g = await geocodeFuzzy(t);
  if (g) return { ok: true, lat: g.lat, lng: g.lng, approx: true, label: g.label };
  return { ok: false, error: "Adresse introuvable : précisez le quartier, ou touchez la carte à l'endroit de la livraison." };
}
