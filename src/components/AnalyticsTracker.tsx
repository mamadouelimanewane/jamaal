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
  }, [pathname]);

  return null;
}
