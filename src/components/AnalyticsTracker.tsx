"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { getAnalyticsSessionId } from "@/lib/analytics-session";

const PRIVATE_PATHS = [/^\/compte(?:\/|$)/, /^\/commande(?:\/|$)/, /^\/suivi(?:\/|$)/, /^\/avis\/[^/]+/, /^\/abonnement(?:\/|$)/, /^\/carte-cadeau\/[^/]+/];

/** Mesure les pages publiques sans enregistrer les identifiants de commande ou de compte. */
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || PRIVATE_PATHS.some((pattern) => pattern.test(pathname))) return;
    void trackEvent({ name: "page_view", path: pathname, sessionId: getAnalyticsSessionId() });
    // Les liens sociaux vers une fiche produit portent `ref` et `utm_source` : attribuer aussi
    // ces visites dans les statistiques de la boutique du vendeur.
    if (pathname.startsWith("/produits/")) {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("ref");
      const source = params.get("utm_source")?.toLowerCase();
      if (slug && ["whatsapp", "instagram", "tiktok", "facebook"].includes(source ?? "")) {
        const sid = getAnalyticsSessionId();
        const body = JSON.stringify({ slug, source, kind: "visite", sid });
        fetch("/api/shop/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    }
  }, [pathname]);

  return null;
}
