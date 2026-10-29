"use client";

import { useMemo } from "react";
import { DeliveryMap, type MapPath, type MapPoint } from "@/components/maps/DeliveryMap";

/** Carte d'une livraison (fiche commande) : dépôt, adresse, positions à chaque étape, trajet du livreur. */
export function OrderDeliveryMap(props: {
  depot: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number } | null;
  events: { id: string; n: number; lat: number; lng: number; label: string }[];
  trail: [number, number][];
  livreur: { lat: number; lng: number; label: string; stale: boolean } | null;
}) {
  const { points, paths } = useMemo(() => {
    const points: MapPoint[] = [{ id: "depot", kind: "depot", lat: props.depot.lat, lng: props.depot.lng, label: `Dépôt · ${props.depot.label}` }];
    if (props.destination) points.push({ id: "dest", kind: "destination", ...props.destination, label: "Adresse de livraison" });
    for (const e of props.events) points.push({ id: `e-${e.id}`, kind: "event", lat: e.lat, lng: e.lng, n: e.n, label: e.label });
    if (props.livreur) points.push({ id: "liv", kind: "livreur", lat: props.livreur.lat, lng: props.livreur.lng, stale: props.livreur.stale, label: props.livreur.label });
    const paths: MapPath[] = props.trail.length > 1 ? [{ id: "trail", kind: "trail", coords: props.trail, color: "#1f7a55" }] : [];
    return { points, paths };
  }, [props]);
  return <DeliveryMap points={points} paths={paths} height={300} ariaLabel="Carte de la livraison" />;
}
