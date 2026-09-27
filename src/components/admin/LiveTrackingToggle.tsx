"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { shareLivreurPosition } from "@/lib/actions/livreurs";

const MIN_INTERVAL_MS = 15_000;

export function LiveTrackingToggle() {
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }

  function start() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
        lastSentRef.current = now;
        shareLivreurPosition(pos.coords.latitude, pos.coords.longitude)
          .then(() => setStatus("sent"))
          .catch(() => setStatus("error"));
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <button
      onClick={() => (tracking ? stop() : start())}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        tracking ? "bg-emerald-600 text-white" : "bg-navy text-white hover:bg-navy-light"
      }`}
    >
      {tracking ? <Navigation size={16} className="animate-pulse" /> : <MapPin size={16} />}
      {tracking
        ? status === "error"
          ? "Suivi actif (signal faible)"
          : "Suivi en direct actif"
        : "Activer le suivi en direct"}
    </button>
  );
}
