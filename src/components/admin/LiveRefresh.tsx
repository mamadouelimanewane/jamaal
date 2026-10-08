"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Suivi en direct : recharge les données de la page toutes les `seconds` secondes tant que
 * l'onglet est visible, et dès qu'on revient sur l'onglet. Rien n'est rechargé en arrière-plan.
 */
export function LiveRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Heure affichée seulement après la première mise à jour (sinon serveur et navigateur diffèrent).
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      setUpdatedAt(new Date());
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
      </span>
      {pending ? "Mise à jour…" : updatedAt ? `En direct · ${updatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "En direct"}
    </span>
  );
}
