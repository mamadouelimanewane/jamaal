"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: "depot" | "destination" | "livreur" | "client";
  label?: string;
  /** Marqueur que l'utilisateur peut déplacer (sélection du point de livraison). */
  draggable?: boolean;
};

const COLORS: Record<MapPoint["kind"], string> = {
  depot: "#182845",
  destination: "#9b5c4d",
  client: "#9b5c4d",
  livreur: "#1f7a55",
};
const SYMBOL: Record<MapPoint["kind"], string> = { depot: "J", destination: "", client: "", livreur: "🛵" };

function pinHtml(kind: MapPoint["kind"]) {
  const c = COLORS[kind];
  if (kind === "livreur") {
    return `<div style="width:34px;height:34px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:17px">${SYMBOL.livreur}</div>`;
  }
  return `<div style="position:relative;width:30px;height:40px"><svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 39C15 39 28 24 28 14A13 13 0 1 0 2 14C2 24 15 39 15 39Z" fill="${c}" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="14" r="5.5" fill="#fff"/></svg>${SYMBOL[kind] ? `<span style="position:absolute;top:6px;left:0;width:30px;text-align:center;font:700 11px Arial;color:${c}">${SYMBOL[kind]}</span>` : ""}</div>`;
}

/**
 * Carte OpenStreetMap (Leaflet) : dépôt, destination, livreurs, trajet.
 * `onMove` est appelé quand l'utilisateur déplace le marqueur `draggable` ou touche la carte.
 */
export function DeliveryMap({
  points,
  route,
  onMove,
  height = 320,
  fit = true,
}: {
  points: MapPoint[];
  /** Ligne pointillée entre deux identifiants de points (ex. livreur → destination). */
  route?: [string, string];
  onMove?: (lat: number, lng: number) => void;
  height?: number;
  fit?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const onMoveRef = useRef(onMove);
  // Nombre de points lors du dernier recadrage : on recadre quand un point apparaît ou disparaît.
  const fittedCount = useRef(-1);

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
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      // Déclenche le dessin des points maintenant que la carte existe.
      el.current.dispatchEvent(new Event("map-ready"));
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Dessin des points et du trajet à chaque changement.
  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();
      const byId = new Map(points.map((p) => [p.id, p]));
      for (const p of points) {
        const icon = L.divIcon({ html: pinHtml(p.kind), className: "", iconSize: p.kind === "livreur" ? [34, 34] : [30, 40], iconAnchor: p.kind === "livreur" ? [17, 17] : [15, 39] });
        const marker = L.marker([p.lat, p.lng], { icon, draggable: !!p.draggable, title: p.label });
        if (p.label) marker.bindTooltip(p.label, { direction: "top", offset: [0, p.kind === "livreur" ? -18 : -38] });
        if (p.draggable) marker.on("dragend", () => {
          const ll = marker.getLatLng();
          onMoveRef.current?.(ll.lat, ll.lng);
        });
        marker.addTo(layer.current);
      }
      if (route) {
        const a = byId.get(route[0]);
        const b = byId.get(route[1]);
        if (a && b) L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: "#1f7a55", weight: 4, dashArray: "8 8", opacity: 0.85 }).addTo(layer.current);
      }
      if (fit && points.length && (fittedCount.current !== points.length || points.some((p) => p.kind === "livreur"))) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
        if (points.length === 1) map.current.setView(bounds.getCenter(), 15);
        else map.current.fitBounds(bounds, { paddingTopLeft: [56, 64], paddingBottomRight: [40, 24], maxZoom: 16 });
        fittedCount.current = points.length;
      }
    };
    draw();
    const node = el.current;
    node?.addEventListener("map-ready", draw);
    return () => {
      cancelled = true;
      node?.removeEventListener("map-ready", draw);
    };
  }, [points, route, fit]);

  return <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-xl border border-line" role="application" aria-label="Carte de livraison" />;
}
