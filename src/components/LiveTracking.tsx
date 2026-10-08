"use client";

import { useEffect, useState } from "react";
import { Check, Clock } from "lucide-react";
import { DeliveryMap, type MapPoint } from "@/components/maps/DeliveryMap";
import { DELIVERY_STEPS, DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";

type Track = {
  deliveryStatus: DeliveryStatus | null;
  deliveryLabel: string | null;
  deliveredAt: string | null;
  depot: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number } | null;
  livreur: { name: string; lat: number | null; lng: number | null; lastSeenAt: string | null } | null;
  remainingKm: number | null;
  etaMinutes: number | null;
  events: { status: string; label: string; at: string; note: string | null }[];
};

const time = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** Suivi en direct d'une livraison : carte, heure d'arrivée estimée et étapes horodatées. */
export function LiveTracking({ orderId }: { orderId: string }) {
  const [data, setData] = useState<Track | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/track/${orderId}`, { cache: "no-store" });
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        // nouvel essai au prochain intervalle
      }
    };
    poll();
    const timer = setInterval(poll, 10_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [orderId]);

  if (!data || !data.deliveryStatus) return null;

  const failed = data.deliveryStatus === "ECHEC";
  const current = DELIVERY_STEPS.indexOf(data.deliveryStatus as (typeof DELIVERY_STEPS)[number]);
  const at = new Map<string, string>();
  for (const e of data.events) at.set(e.status, e.at);
  const failure = [...data.events].reverse().find((e) => e.status === "ECHEC");

  const points: MapPoint[] = [{ id: "depot", kind: "depot", lat: data.depot.lat, lng: data.depot.lng, label: data.depot.label }];
  if (data.destination) points.push({ id: "dest", kind: "destination", ...data.destination, label: "Votre adresse" });
  if (data.livreur?.lat != null && data.livreur?.lng != null) points.push({ id: "livreur", kind: "livreur", lat: data.livreur.lat, lng: data.livreur.lng, label: data.livreur.name });
  const hasLivreur = points.some((p) => p.id === "livreur");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-sm text-navy/70">État de la livraison</p>
        <p className={`text-xl font-semibold ${failed ? "text-red-700" : "text-navy"}`}>{data.deliveryLabel}</p>
        {data.etaMinutes != null && !failed && data.deliveryStatus !== "LIVREE" && (
          <p className="mt-1 flex items-start gap-2 text-[15px] text-emerald-800">
            <Clock size={16} className="mt-1 shrink-0" />
            <span>Arrivée estimée dans environ <strong>{data.etaMinutes} min</strong> ({data.remainingKm?.toLocaleString("fr-FR")} km)</span>
          </p>
        )}
        {data.livreur && data.deliveryStatus !== "LIVREE" && <p className="mt-1 text-sm text-navy/75">Votre livreur : {data.livreur.name}</p>}
        {failed && failure?.note && <p className="mt-2 text-sm text-red-800">{failure.note}. Notre équipe vous recontacte pour une nouvelle livraison.</p>}
      </div>

      {data.destination && data.deliveryStatus !== "LIVREE" && (
        <DeliveryMap points={points} route={hasLivreur && data.destination ? ["livreur", "dest"] : undefined} height={300} />
      )}

      <ol className="rounded-2xl border border-line bg-white p-5">
        {DELIVERY_STEPS.map((step, i) => {
          const done = !failed && i <= current;
          return (
            <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
              {i < DELIVERY_STEPS.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${done && i < current ? "bg-emerald-600" : "bg-line"}`} aria-hidden />}
              <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-600 text-white" : "border-2 border-line bg-white"}`}>{done && <Check size={14} />}</span>
              <div>
                <p className={`text-[15px] ${done ? "font-semibold text-navy" : "text-navy/60"}`}>{DELIVERY_LABELS[step]}</p>
                {at.get(step) && <p className="text-sm text-navy/70">{time(at.get(step)!)}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
