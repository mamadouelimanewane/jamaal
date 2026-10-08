"use client";

import { useEffect, useRef, useState } from "react";
import { House, LocateFixed, Store, UserRound } from "lucide-react";
import { DeliveryMap } from "@/components/maps/DeliveryMap";
import { quoteDeliveryForCart } from "@/lib/actions/delivery-quote";
import type { DeliveryQuote } from "@/lib/delivery";
import { formatPrice } from "@/lib/currency";

type Target = "RETRAIT" | "CLIENT" | "VENDEUR";
type Point = { lat: number; lng: number } | null;

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";

/**
 * Choix du vendeur : remettre lui-même le colis, faire livrer son client à l'adresse du client,
 * ou se faire livrer chez lui quand il achète pour le compte du client.
 */
export function ConsultantDeliveryFields({
  productsTotal,
  depot,
  vendor,
}: {
  productsTotal: number;
  depot: { lat: number; lng: number; label: string };
  vendor: { address: string | null; lat: number | null; lng: number | null };
}) {
  const savedPoint: Point = vendor.lat != null && vendor.lng != null ? { lat: vendor.lat, lng: vendor.lng } : null;
  const [target, setTarget] = useState<Target>("CLIENT");
  const [clientPoint, setClientPoint] = useState<Point>(null);
  const [vendorPoint, setVendorPoint] = useState<Point>(savedPoint);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const seq = useRef(0);

  const point = target === "CLIENT" ? clientPoint : target === "VENDEUR" ? vendorPoint : null;
  const setPoint = target === "CLIENT" ? setClientPoint : setVendorPoint;

  useEffect(() => {
    if (!point) return;
    const id = ++seq.current;
    quoteDeliveryForCart(point.lat, point.lng, productsTotal).then((q) => id === seq.current && setQuote(q)).catch(() => {});
  }, [point, productsTotal]);

  function locate() {
    if (!navigator.geolocation) return setGeoError("Géolocalisation indisponible : touchez la carte.");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => setPoint({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoError("Position refusée : touchez la carte à l'endroit de la livraison."),
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  const option = (t: Target) => `flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${target === t ? "border-navy bg-navy/5" : "border-line bg-white hover:border-navy/40"}`;

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-navy">3. Livraison</legend>
      <input type="hidden" name="deliveryTarget" value={target} />
      {point && <><input type="hidden" name="deliveryLat" value={point.lat} /><input type="hidden" name="deliveryLng" value={point.lng} /></>}

      <label className={option("CLIENT")}>
        <input type="radio" checked={target === "CLIENT"} onChange={() => { setTarget("CLIENT"); setQuote(null); }} className="mt-1" />
        <span><span className="flex items-center gap-1.5 font-semibold text-navy"><UserRound size={15} /> JAMAAL livre mon client</span><span className="text-navy/75">À l&apos;adresse du client ; le livreur l&apos;appelle et lui demande son code.</span></span>
      </label>
      <label className={option("VENDEUR")}>
        <input type="radio" checked={target === "VENDEUR"} onChange={() => { setTarget("VENDEUR"); setQuote(null); }} className="mt-1" />
        <span><span className="flex items-center gap-1.5 font-semibold text-navy"><House size={15} /> JAMAAL me livre (j&apos;achète pour mon client)</span><span className="text-navy/75">À mon adresse ; c&apos;est moi que le livreur contacte.</span></span>
      </label>
      <label className={option("RETRAIT")}>
        <input type="radio" checked={target === "RETRAIT"} onChange={() => { setTarget("RETRAIT"); setQuote(null); }} className="mt-1" />
        <span><span className="flex items-center gap-1.5 font-semibold text-navy"><Store size={15} /> Je remets moi-même le colis</span><span className="text-navy/75">Sans livraison JAMAAL, sans frais.</span></span>
      </label>

      {target === "VENDEUR" && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-navy/85">
            Mon adresse de livraison
            <textarea name="vendorAddress" defaultValue={vendor.address ?? ""} rows={2} placeholder="Quartier, rue, repère" className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm text-navy/85">
            <input type="checkbox" name="saveVendorAddress" defaultChecked={!savedPoint} /> Enregistrer comme mon adresse habituelle
          </label>
        </div>
      )}

      {target !== "RETRAIT" && (
        <div className="space-y-2">
          <button type="button" onClick={locate} className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            <LocateFixed size={16} /> {target === "CLIENT" ? "Je suis chez le client : utiliser ma position" : "Utiliser ma position"}
          </button>
          <p className="text-xs text-navy/75">Ou touchez la carte à l&apos;endroit de la livraison ; le repère se déplace.</p>
          {geoError && <p role="alert" className="text-xs text-rose-dark">{geoError}</p>}
          <DeliveryMap
            height={260}
            onMove={(lat, lng) => setPoint({ lat, lng })}
            points={[
              { id: "depot", kind: "depot", lat: depot.lat, lng: depot.lng, label: depot.label },
              ...(point ? [{ id: "dest", kind: "client" as const, ...point, label: target === "CLIENT" ? "Chez le client" : "Chez moi", draggable: true }] : []),
            ]}
          />
          {!point && <p className="text-sm text-amber-900">Placez le point de livraison pour calculer les frais.</p>}
          {point && quote && (quote.ok ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{quote.distanceKm.toLocaleString("fr-FR")} km du dépôt · frais de livraison <strong>{quote.free ? "offerts" : formatPrice(quote.fee)}</strong>, ajoutés au total.</p>
          ) : (
            <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{quote.error}</p>
          ))}
        </div>
      )}
    </fieldset>
  );
}
