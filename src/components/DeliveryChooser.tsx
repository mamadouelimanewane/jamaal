"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Store } from "lucide-react";
import { DeliveryMap } from "@/components/maps/DeliveryMap";
import { getCartDeliveryInfo, quoteDeliveryForCart, type CartDeliveryInfo } from "@/lib/actions/delivery-quote";
import type { DeliveryQuote } from "@/lib/delivery";
import { formatPrice } from "@/lib/currency";

export type DeliveryChoice =
  | { mode: "RETRAIT" }
  | { mode: "LIVRAISON"; lat: number | null; lng: number | null; quote: DeliveryQuote | null };

/** Choix de la remise au panier : livraison géolocalisée (frais selon la distance) ou retrait. */
export function DeliveryChooser({ productsTotal, value, onChange }: { productsTotal: number; value: DeliveryChoice; onChange: (v: DeliveryChoice) => void }) {
  const [info, setInfo] = useState<CartDeliveryInfo | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    getCartDeliveryInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  const lat = value.mode === "LIVRAISON" ? value.lat : null;
  const lng = value.mode === "LIVRAISON" ? value.lng : null;

  // Nouveau devis à chaque déplacement du repère (ou changement du montant des produits).
  useEffect(() => {
    if (value.mode !== "LIVRAISON" || lat == null || lng == null) return;
    const id = ++seq.current;
    quoteDeliveryForCart(lat, lng, productsTotal)
      .then((quote) => {
        if (id === seq.current) onChange({ mode: "LIVRAISON", lat, lng, quote });
      })
      .catch(() => {});
    // onChange est stable côté parent ; on ne relance que si la position ou le montant changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode, lat, lng, productsTotal]);

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil : placez le repère sur la carte.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ mode: "LIVRAISON", lat: pos.coords.latitude, lng: pos.coords.longitude, quote: null });
      },
      () => {
        setLocating(false);
        setGeoError("Position refusée ou introuvable : touchez la carte à l'endroit de la livraison.");
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  const option = (active: boolean) =>
    `flex flex-1 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${active ? "border-navy bg-navy/5" : "border-line bg-white hover:border-navy/40"}`;

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-navy">Livraison</legend>
      <div className="flex flex-col gap-2">
        <label className={option(value.mode === "LIVRAISON")}>
          <input type="radio" name="deliveryMode" checked={value.mode === "LIVRAISON"} onChange={() => onChange({ mode: "LIVRAISON", lat, lng, quote: null })} className="mt-1" />
          <span><span className="flex items-center gap-1.5 font-semibold text-navy"><MapPin size={15} /> Livraison chez moi</span><span className="text-navy/75">Frais selon la distance</span></span>
        </label>
        <label className={option(value.mode === "RETRAIT")}>
          <input type="radio" name="deliveryMode" checked={value.mode === "RETRAIT"} onChange={() => onChange({ mode: "RETRAIT" })} className="mt-1" />
          <span><span className="flex items-center gap-1.5 font-semibold text-navy"><Store size={15} /> Retrait</span><span className="text-navy/75">Chez mon consultant, sans frais</span></span>
        </label>
      </div>

      {value.mode === "LIVRAISON" && (
        <div className="space-y-2">
          <button type="button" onClick={locate} disabled={locating} className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
            <LocateFixed size={16} /> {locating ? "Localisation…" : "Utiliser ma position"}
          </button>
          <p className="text-xs text-navy/75">Ou touchez la carte à l&apos;endroit de la livraison ; vous pouvez déplacer le repère.</p>
          {geoError && <p role="alert" className="text-xs text-rose-dark">{geoError}</p>}
          {info && (
            <DeliveryMap
              height={260}
              onMove={(la, ln) => onChange({ mode: "LIVRAISON", lat: la, lng: ln, quote: null })}
              points={[
                { id: "depot", kind: "depot", lat: info.depot.lat, lng: info.depot.lng, label: info.depot.label },
                ...(lat != null && lng != null ? [{ id: "client", kind: "client" as const, lat, lng, label: "Livraison ici", draggable: true }] : []),
              ]}
            />
          )}
          {value.quote && (
            value.quote.ok ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {value.quote.distanceKm.toLocaleString("fr-FR")} km du dépôt · frais de livraison{" "}
                <strong>{value.quote.free ? "offerts" : formatPrice(value.quote.fee)}</strong>
              </p>
            ) : (
              <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{value.quote.error}</p>
            )
          )}
          {info && info.freeAbove > 0 && <p className="text-xs text-navy/75">Livraison offerte dès {formatPrice(info.freeAbove)} d&apos;achats.</p>}
        </div>
      )}
    </fieldset>
  );
}
