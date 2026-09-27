"use client";

import { useEffect, useState } from "react";

interface TrackData {
  status: string;
  deliveryMode: string;
  updatedAt: string;
  livreur: { name: string; lat: number | null; lng: number | null; lastSeenAt: string | null } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins === 1) return "il y a 1 minute";
  return `il y a ${mins} minutes`;
}

export function LiveDeliveryMap({ orderId }: { orderId: string }) {
  const [data, setData] = useState<TrackData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/track/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // silencieux : on réessaiera au prochain intervalle
      }
    }
    poll();
    const interval = setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  if (!data || data.deliveryMode !== "LIVRAISON_JAMAAL" || !data.livreur?.lat || !data.livreur?.lng) {
    return null;
  }

  if (data.status !== "CONFIRMEE" && data.status !== "EXPEDIEE") {
    return null;
  }

  const { lat, lng } = data.livreur;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <iframe
        key={`${lat}-${lng}`}
        title="Position du livreur"
        src={`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
        className="h-64 w-full border-0"
        loading="lazy"
      />
      <div className="flex items-center justify-between px-4 py-3 text-xs text-navy/60">
        <span>🚴 {data.livreur.name} est en route</span>
        <span>Mise à jour {timeAgo(data.livreur.lastSeenAt)}</span>
      </div>
    </div>
  );
}
