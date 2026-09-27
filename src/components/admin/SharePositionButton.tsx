"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { shareLivreurPosition } from "@/lib/actions/livreurs";

export function SharePositionButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  function share() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await shareLivreurPosition(pos.coords.latitude, pos.coords.longitude);
        setStatus("done");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <button
      onClick={share}
      className="flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
    >
      <MapPin size={16} />
      {status === "loading" && "Localisation…"}
      {status === "idle" && "Partager ma position"}
      {status === "done" && "Position partagée ✓"}
      {status === "error" && "Réessayer"}
    </button>
  );
}
