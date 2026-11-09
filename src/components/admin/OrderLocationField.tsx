"use client";

import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { LocationInput, type Located } from "@/components/maps/LocationInput";
import { quoteDeliveryForCart } from "@/lib/actions/delivery-quote";
import { formatPrice } from "@/lib/currency";

/**
 * Position de livraison d'une commande (admin) : coller un lien Google Maps / WhatsApp, un Plus Code ou
 * l'adresse, ou corriger latitude/longitude. Les frais recalculés sont montrés avant d'enregistrer.
 */
export function OrderLocationField({ lat, lng, productsTotal, currentFee, paid, customerPhone }: { lat: number | null; lng: number | null; productsTotal: number; currentFee: number; paid: boolean; customerPhone: string | null }) {
  const [pos, setPos] = useState({ lat: lat == null ? "" : String(lat), lng: lng == null ? "" : String(lng) });
  const [placed, setPlaced] = useState<Located | null>(null);
  const [quote, setQuote] = useState<{ fee: number; km: number } | { error: string } | null>(null);
  const [pending, start] = useTransition();

  function onLocated(l: Located) {
    setPlaced(l);
    setPos({ lat: l.lat.toFixed(6), lng: l.lng.toFixed(6) });
    start(async () => {
      const q = await quoteDeliveryForCart(l.lat, l.lng, productsTotal);
      setQuote(q.ok ? { fee: q.fee, km: q.distanceKm } : { error: q.error ?? "Hors zone de livraison." });
    });
  }

  return (
    <div className="grid gap-2 rounded-xl border border-line bg-cream/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-navy"><MapPin size={14} className="text-rose-dark" /> Position de livraison</p>
      <LocationInput onLocated={onLocated} recipientPhone={customerPhone} />
      <input type="hidden" name="deliveryApprox" value={placed?.approx ? "1" : "0"} />
      {placed?.label && <input type="hidden" name="deliveryPlace" value={placed.label} />}
      {placed && (
        <p className="text-xs text-navy/80">
          {placed.approx ? "Position approximative (adresse) : " : "Position trouvée : "}
          <strong>{placed.label}</strong>
          {pending ? " · calcul des frais…" : quote && ("error" in quote ? <span className="text-rose-dark"> · {quote.error}</span> : <> · {quote.km.toLocaleString("fr-FR")} km · frais <strong>{formatPrice(quote.fee)}</strong>{quote.fee !== currentFee ? (paid ? " (commande déjà payée : frais inchangés)" : ` (au lieu de ${formatPrice(currentFee)}, total mis à jour)`) : ""}</>)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-navy/85">
          Latitude
          <input name="deliveryLat" inputMode="decimal" value={pos.lat} onChange={(e) => setPos((p) => ({ ...p, lat: e.target.value }))} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-navy/85">
          Longitude
          <input name="deliveryLng" inputMode="decimal" value={pos.lng} onChange={(e) => setPos((p) => ({ ...p, lng: e.target.value }))} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        </label>
      </div>
      <p className="text-[11px] text-navy/60">Les frais de livraison et la part du livreur sont recalculés à l&apos;enregistrement.</p>
    </div>
  );
}
