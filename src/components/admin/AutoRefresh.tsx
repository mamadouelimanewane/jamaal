"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Recharge les données de la page à intervalle régulier (suivi en temps réel) et affiche l'heure de mise à jour. */
export function AutoRefresh({ everySeconds = 15 }: { everySeconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<string>("");
  useEffect(() => {
    const stamp = () => setAt(new Date().toLocaleTimeString("fr-FR"));
    stamp();
    const timer = setInterval(() => {
      router.refresh();
      stamp();
    }, everySeconds * 1000);
    return () => clearInterval(timer);
  }, [everySeconds, router]);
  return <span className="text-xs text-navy/60 print:hidden">Mise à jour automatique · dernière à {at || "…"}</span>;
}
