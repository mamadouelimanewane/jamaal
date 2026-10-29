"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: "depot" | "destination" | "livreur" | "client" | "stop" | "event" | "pending";
  label?: string;
  /** Numéro affiché dans le repère (ordre de passage). */
  n?: number | string;
  /** Livreur sans position récente : repère grisé. */
  stale?: boolean;
  /** Cap du livreur (degrés), flèche de direction. */
  heading?: number | null;
  /** Rayon de précision GPS (m) autour du livreur. */
  accuracy?: number | null;
  /** Marqueur que l'utilisateur peut déplacer (sélection du point de livraison). */
  draggable?: boolean;
};

export type MapPath = {
  id: string;
  coords: [number, number][];
  /** route : itinéraire à suivre ; trail : trajet déjà parcouru ; plan : liaison estimée (ligne droite). */
  kind: "route" | "trail" | "plan";
  color?: string;
};

const COLORS: Record<MapPoint["kind"], string> = {
  depot: "#182845",
  destination: "#9b5c4d",
  client: "#9b5c4d",
  stop: "#9b5c4d",
  pending: "#8a8f98",
  event: "#5b6b86",
  livreur: "#1f7a55",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function pinHtml(p: MapPoint) {
  const c = p.kind === "livreur" && p.stale ? "#8a8f98" : COLORS[p.kind];
  if (p.kind === "livreur") {
    const arrow = p.heading != null && !p.stale ? `<div style="position:absolute;left:12px;top:-8px;width:0;height:0;transform-origin:6px 26px;transform:rotate(${Math.round(p.heading)}deg);border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid ${c}"></div>` : "";
    return `<div style="position:relative;width:36px;height:36px">${arrow}<div style="position:relative;width:36px;height:36px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 0 0 ${p.stale ? 0 : 6}px ${c}33,0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:17px">🛵</div></div>`;
  }
  if (p.kind === "event") {
    return `<div style="width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid ${c};display:flex;align-items:center;justify-content:center;font:700 11px Arial;color:${c}">${esc(String(p.n ?? "•"))}</div>`;
  }
  const sym = p.kind === "depot" ? "J" : p.n != null ? esc(String(p.n)) : "";
  return `<div style="position:relative;width:30px;height:40px"><svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 39C15 39 28 24 28 14A13 13 0 1 0 2 14C2 24 15 39 15 39Z" fill="${c}" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="14" r="${sym ? 8 : 5.5}" fill="#fff"/></svg>${sym ? `<span style="position:absolute;top:7px;left:0;width:30px;text-align:center;font:700 11px Arial;color:${c}">${sym}</span>` : ""}</div>`;
}

const STYLE: Record<MapPath["kind"], { weight: number; dashArray?: string; opacity: number; color: string }> = {
  route: { weight: 5, opacity: 0.85, color: "#1f7a55" },
  trail: { weight: 4, opacity: 0.6, color: "#5b6b86", dashArray: "2 7" },
  plan: { weight: 3, opacity: 0.8, color: "#1f7a55", dashArray: "8 8" },
};

/**
 * Carte OpenStreetMap (Leaflet) : dépôt, arrêts numérotés, livreurs (cap, précision), itinéraire routier
 * et trajet déjà parcouru. Le cadrage se fait à l'ouverture et quand la liste des repères change ;
 * le bouton « Recentrer » le refait à la demande (on peut déplacer la carte pendant le suivi en direct).
 */
export function DeliveryMap({
  points,
  route,
  paths,
  onMove,
  height = 320,
  fit = true,
  follow,
  ariaLabel = "Carte de livraison",
}: {
  points: MapPoint[];
  /** Ligne pointillée entre deux identifiants de points (ex. livreur → destination). */
  route?: [string, string];
  paths?: MapPath[];
  onMove?: (lat: number, lng: number) => void;
  height?: number | string;
  fit?: boolean;
  /** Identifiant d'un point à garder au centre (ex. le livreur lui-même). */
  follow?: string;
  ariaLabel?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const onMoveRef = useRef(onMove);
  const fittedKey = useRef("");
  const userMoved = useRef(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Création de la carte (une seule fois).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([14.6928, -17.4467], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e) => onMoveRef.current?.(e.latlng.lat, e.latlng.lng));
      m.on("dragstart", () => {
        userMoved.current = true;
        setMoved(true);
      });
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      el.current.dispatchEvent(new Event("map-ready"));
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Dessin des repères et des tracés à chaque changement.
  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();
      const byId = new Map(points.map((p) => [p.id, p]));
      const all: [number, number][] = points.map((p) => [p.lat, p.lng]);

      for (const path of paths ?? []) {
        if (path.coords.length < 2) continue;
        const st = STYLE[path.kind];
        if (path.kind === "route") L.polyline(path.coords, { color: "#fff", weight: st.weight + 3, opacity: 0.9 }).addTo(layer.current);
        L.polyline(path.coords, { ...st, color: path.color ?? st.color }).addTo(layer.current);
        if (path.kind !== "trail") all.push(...path.coords);
      }
      if (route) {
        const a = byId.get(route[0]);
        const b = byId.get(route[1]);
        if (a && b) L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { ...STYLE.plan }).addTo(layer.current);
      }
      for (const p of points) {
        if (p.kind === "livreur" && p.accuracy && p.accuracy > 15 && p.accuracy < 2000 && !p.stale) {
          L.circle([p.lat, p.lng], { radius: p.accuracy, color: COLORS.livreur, weight: 1, opacity: 0.4, fillOpacity: 0.08 }).addTo(layer.current);
        }
        const big = p.kind === "livreur";
        const small = p.kind === "event";
        const icon = L.divIcon({ html: pinHtml(p), className: "", iconSize: big ? [36, 36] : small ? [22, 22] : [30, 40], iconAnchor: big ? [18, 18] : small ? [11, 11] : [15, 39] });
        const marker = L.marker([p.lat, p.lng], { icon, draggable: !!p.draggable, title: p.label, zIndexOffset: big ? 1000 : 0 });
        if (p.label) marker.bindTooltip(esc(p.label), { direction: "top", offset: [0, big ? -20 : small ? -12 : -38] });
        if (p.draggable)
          marker.on("dragend", () => {
            const ll = marker.getLatLng();
            onMoveRef.current?.(ll.lat, ll.lng);
          });
        marker.addTo(layer.current);
      }

      const key = points.map((p) => p.id).sort().join("|");
      const followed = follow ? byId.get(follow) : undefined;
      if (followed && !userMoved.current) {
        map.current.setView([followed.lat, followed.lng], Math.max(map.current.getZoom(), 15));
      } else if (fit && all.length && fittedKey.current !== key && !userMoved.current) {
        const bounds = L.latLngBounds(all);
        if (all.length === 1) map.current.setView(bounds.getCenter(), 15);
        else map.current.fitBounds(bounds, { paddingTopLeft: [56, 64], paddingBottomRight: [40, 24], maxZoom: 16 });
        fittedKey.current = key;
      }
    };
    draw();
    const node = el.current;
    node?.addEventListener("map-ready", draw);
    return () => {
      cancelled = true;
      node?.removeEventListener("map-ready", draw);
    };
  }, [points, route, paths, fit, follow]);

  async function recenter() {
    const L = (await import("leaflet")).default;
    if (!map.current) return;
    userMoved.current = false;
    setMoved(false);
    const followed = follow ? points.find((p) => p.id === follow) : undefined;
    if (followed) {
      map.current.setView([followed.lat, followed.lng], 16);
      return;
    }
    const all: [number, number][] = [...points.map((p) => [p.lat, p.lng] as [number, number]), ...(paths ?? []).filter((p) => p.kind !== "trail").flatMap((p) => p.coords)];
    if (all.length === 1) map.current.setView(all[0], 15);
    else if (all.length) map.current.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 16 });
  }

  return (
    <div className="relative">
      <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-xl border border-line" role="application" aria-label={ariaLabel} />
      {moved && (
        <button type="button" onClick={recenter} className="absolute bottom-3 right-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-navy shadow-md">
          <LocateFixed size={14} /> Recentrer
        </button>
      )}
    </div>
  );
}
