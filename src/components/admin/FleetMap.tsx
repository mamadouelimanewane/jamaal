"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bike, Crosshair, MessageCircle, Phone } from "lucide-react";
import { DeliveryMap, type MapPath, type MapPoint } from "@/components/maps/DeliveryMap";
import { DELIVERY_LABELS } from "@/lib/delivery";
import { ago } from "@/lib/geo-track";
import { vehicleLabel } from "@/lib/livreur-signup";
import type { Fleet } from "@/lib/tour/fleet";

const TRAIL_COLORS = ["#1f7a55", "#2a5bd7", "#b0558f", "#c27c0e", "#4b7f8c", "#7a4fd1"];

/** Carte de la flotte en direct (rafraîchie toutes les 15 s) : livreurs, trajets récents, arrêts, livraisons à attribuer. */
export function FleetMap({ initial }: { initial: Fleet }) {
  const [fleet, setFleet] = useState(initial);
  const [follow, setFollow] = useState<string | undefined>(undefined);
  const [, tick] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/admin/fleet", { cache: "no-store" });
        if (r.ok) setFleet(await r.json());
      } catch {
        // nouvel essai au prochain intervalle
      }
    };
    const i = setInterval(load, 15_000);
    const t = setInterval(() => tick((n) => n + 1), 5_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(i);
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const { points, paths } = useMemo(() => {
    const points: MapPoint[] = [{ id: "depot", kind: "depot", lat: fleet.depot.lat, lng: fleet.depot.lng, label: `Dépôt · ${fleet.depot.label}` }];
    const paths: MapPath[] = [];
    fleet.livreurs.forEach((l, i) => {
      const color = TRAIL_COLORS[i % TRAIL_COLORS.length];
      if (l.pos) points.push({ id: `l-${l.id}`, kind: "livreur", lat: l.pos.lat, lng: l.pos.lng, stale: !l.live, heading: l.pos.heading, accuracy: l.pos.accuracy, label: `${l.name} · ${l.live ? "en direct" : `hors ligne, ${ago(l.pos.at)}`} · ${l.stops.length} en cours` });
      if (l.trail.length > 1) paths.push({ id: `t-${l.id}`, kind: "trail", coords: l.trail, color });
      l.stops.forEach((s, k) => points.push({ id: `s-${s.id}`, kind: "stop", lat: s.lat, lng: s.lng, n: initials(l.name) + (l.stops.length > 1 ? k + 1 : ""), label: `${s.name} · ${l.name} · ${DELIVERY_LABELS[s.status]}` }));
    });
    for (const p of fleet.pending) points.push({ id: `p-${p.id}`, kind: "pending", lat: p.lat, lng: p.lng, label: `À attribuer : ${p.name}${p.nearest ? ` · plus proche : ${p.nearest.name} (${p.nearest.km.toLocaleString("fr-FR")} km)` : ""}` });
    return { points, paths };
  }, [fleet]);

  const live = fleet.livreurs.filter((l) => l.live).length;
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <DeliveryMap points={points} paths={paths} follow={follow} height="min(70vh, 640px)" ariaLabel="Carte de la flotte des livreurs" />
        <p className="mt-2 text-xs text-navy/65">
          🛵 vert : position en direct (moins de 10 min) · gris : hors ligne · repères numérotés : livraisons en cours (initiales du livreur) · repères gris : à attribuer · pointillés : trajet des 45 dernières minutes. Mise à jour automatique toutes les 15 s.
        </p>
      </div>
      <aside className="space-y-4">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-navy/70">Livreurs ({live} en direct / {fleet.livreurs.length})</h2>
          <ul className="mt-2 space-y-2">
            {fleet.livreurs.map((l) => {
              const phone = l.phone.replace(/\D/g, "");
              return (
                <li key={l.id} className={`rounded-xl border bg-white p-3 text-sm ${follow === `l-${l.id}` ? "border-emerald-600" : "border-line"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-navy"><Bike size={16} className={l.live ? "text-emerald-600" : "text-navy/40"} /><span className="truncate">{l.name}</span></span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${l.live ? "bg-emerald-50 text-emerald-800" : "bg-cream text-navy/65"}`}>{l.live ? "En direct" : l.pos ? ago(l.pos.at) : "Jamais localisé"}</span>
                  </div>
                  <p className="mt-1 text-xs text-navy/70">
                    {[vehicleLabel(l.vehicle), `${l.stops.length} livraison${l.stops.length > 1 ? "s" : ""} en cours`, l.live && l.pos?.accuracy != null ? `± ${Math.round(l.pos.accuracy)} m` : "", l.live && l.pos?.speed != null ? `${Math.round(l.pos.speed * 3.6)} km/h` : ""].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {l.pos && (
                      <button type="button" onClick={() => setFollow(follow === `l-${l.id}` ? undefined : `l-${l.id}`)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-navy hover:bg-cream">
                        <Crosshair size={12} /> {follow === `l-${l.id}` ? "Ne plus suivre" : "Suivre"}
                      </button>
                    )}
                    {phone && <a href={`tel:+${phone}`} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-navy hover:bg-cream"><Phone size={12} /> Appeler</a>}
                    {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-cream"><MessageCircle size={12} /> WhatsApp</a>}
                  </div>
                </li>
              );
            })}
            {fleet.livreurs.length === 0 && <li className="text-sm text-navy/70">Aucun livreur actif.</li>}
          </ul>
        </section>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-navy/70">À attribuer ({fleet.pending.length})</h2>
          <ul className="mt-2 space-y-2">
            {fleet.pending.map((p) => (
              <li key={p.id} className="rounded-xl border border-line bg-white p-3 text-sm">
                <p className="font-semibold text-navy">{p.name}</p>
                <p className="text-xs text-navy/70">{p.address ?? "—"}{p.status === "ECHEC" ? " · après un échec" : ""}</p>
                <p className="mt-1 text-xs text-emerald-800">{p.nearest ? `Livreur le plus proche : ${p.nearest.name} (${p.nearest.km.toLocaleString("fr-FR")} km)` : "Aucun livreur en direct pour l'instant"}</p>
              </li>
            ))}
            {fleet.pending.length === 0 && <li className="text-sm text-navy/70">Rien à attribuer.</li>}
          </ul>
          {fleet.pending.length > 0 && <Link href="/admin/livraisons" className="mt-2 inline-block text-sm font-semibold text-rose-dark hover:underline">Attribuer dans « Livraisons » →</Link>}
        </section>
      </aside>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
