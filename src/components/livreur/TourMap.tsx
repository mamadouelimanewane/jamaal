"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinned, Navigation, Route } from "lucide-react";
import { DeliveryMap, type MapPath, type MapPoint } from "@/components/maps/DeliveryMap";
import { DELIVERY_LABELS } from "@/lib/delivery";
import { isFresh } from "@/lib/geo-track";
import type { Tour } from "@/lib/tour/tour";
import { GPS_EVENT, type GpsDetail } from "./LivreurGps";

const fmtKm = (km: number) => `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);

/** Tous les arrêts dans Google Maps (navigation vocale), dans l'ordre conseillé (dépôt avant les colis à récupérer). */
function googleTour(t: Tour): string {
  const stops = [...t.stops].sort((a, b) => a.n - b.n);
  if (!stops.length) return "";
  const firstToPick = stops.findIndex((s) => s.status === "ASSIGNEE");
  const list: { lat: number; lng: number }[] = firstToPick >= 0 ? [...stops.slice(0, firstToPick), t.depot, ...stops.slice(firstToPick)] : stops;
  const dest = list[list.length - 1];
  const wp = list.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${wp ? `&waypoints=${encodeURIComponent(wp)}` : ""}&travelmode=driving`;
}

/**
 * Carte de la tournée dans l'application Livreur : ma position en direct, le dépôt, les arrêts numérotés
 * dans l'ordre conseillé, l'itinéraire par la route, et le trajet déjà fait.
 */
export function TourMap() {
  const [tour, setTour] = useState<Tour | null>(null);
  const [me, setMe] = useState<GpsDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/livreur/tour", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const t = (await r.json()) as Tour;
        if (!stop) {
          setTour(t);
          setError(false);
        }
      } catch {
        if (!stop) setError(true);
      }
    };
    void load();
    const i = setInterval(load, 30_000);
    const onGps = (e: Event) => setMe((e as CustomEvent<GpsDetail>).detail);
    window.addEventListener(GPS_EVENT, onGps);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      clearInterval(i);
      window.removeEventListener(GPS_EVENT, onGps);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const { points, paths } = useMemo(() => {
    const points: MapPoint[] = [];
    const paths: MapPath[] = [];
    if (!tour) return { points, paths };
    points.push({ id: "depot", kind: "depot", lat: tour.depot.lat, lng: tour.depot.lng, label: `Dépôt · ${tour.depot.label}` });
    for (const s of tour.stops) points.push({ id: s.id, kind: "stop", lat: s.lat, lng: s.lng, n: s.n, label: `${s.n}. ${s.name}${s.minutes != null ? ` · ~${fmtMin(s.minutes)}` : ""}` });
    const pos = me ?? (tour.me && isFresh(tour.me.at) ? { ...tour.me, heading: null } : null);
    if (pos) points.push({ id: "me", kind: "livreur", lat: pos.lat, lng: pos.lng, label: "Ma position", accuracy: pos.accuracy, heading: pos.heading });
    if (tour.trail.length > 1) paths.push({ id: "trail", kind: "trail", coords: tour.trail.map((p) => [p.lat, p.lng]) });
    if (tour.route) paths.push({ id: "route", kind: tour.route.source === "osrm" ? "route" : "plan", coords: tour.route.path });
    return { points, paths };
  }, [tour, me]);

  if (!tour) return error ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Carte indisponible pour le moment (réseau).</p> : <div className="h-[340px] animate-pulse rounded-xl bg-cream" aria-hidden="true" />;
  if (!tour.stops.length && !tour.unlocated.length) return null;
  const next = [...tour.stops].sort((a, b) => a.n - b.n)[0];
  const gmaps = googleTour(tour);

  return (
    <section className="rounded-2xl border border-line bg-white p-3 sm:p-4" aria-label="Ma tournée">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><Route size={18} /> Ma tournée</h2>
          <p className="text-sm text-navy/75">
            {tour.stops.length} arrêt{tour.stops.length > 1 ? "s" : ""}
            {tour.route ? ` · ${fmtKm(tour.route.km)} · environ ${fmtMin(tour.route.minutes + (tour.pickup ? 5 : 0))}` : ""}
            {tour.pickup ? " · passage au dépôt d'abord" : ""}
            {tour.route?.source === "estimation" ? " (estimation)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && (
            <a href={`https://waze.com/ul?ll=${next.lat},${next.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm font-semibold text-navy hover:bg-cream">
              <Navigation size={15} /> Waze : arrêt {next.n}
            </a>
          )}
          {gmaps && (
            <a href={gmaps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light">
              <MapPinned size={15} /> Toute la tournée (Maps)
            </a>
          )}
        </div>
      </div>
      <DeliveryMap points={points} paths={paths} height={340} ariaLabel="Carte de ma tournée" />
      <ol className="mt-3 space-y-1.5 px-1 text-sm">
        {[...tour.stops].sort((a, b) => a.n - b.n).map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9b5c4d] text-[11px] font-bold text-white">{s.n}</span>
            <span className="min-w-0 flex-1 text-ink">
              <a href={`#livraison-${s.id}`} className="font-semibold hover:underline">{s.name}</a>
              <span className="text-navy/70"> · {DELIVERY_LABELS[s.status]}{s.minutes != null ? ` · ~${fmtMin(s.minutes)} (${fmtKm(s.km ?? 0)})` : ""}{s.approx ? " · position approximative" : ""}</span>
            </span>
          </li>
        ))}
        {tour.unlocated.map((u) => (
          <li key={u.id} className="flex items-start gap-2 text-amber-900">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold">?</span>
            <span><a href={`#livraison-${u.id}`} className="font-semibold hover:underline">{u.name}</a> · pas de position sur la carte : appelez le destinataire</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
