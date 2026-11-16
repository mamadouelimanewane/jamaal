"use client";

import { useEffect } from "react";
import { detectSource } from "@/lib/shop/shop-stats";

const KEY = "jamaal_visite";
const SOURCE_KEY = "jamaal_visite_source";

/** Source de la visite, retenue pour la session : les pages suivantes n'ont plus l'identifiant de clic. */
function visitSource(): string {
  const found = detectSource({ search: window.location.search, referrer: document.referrer, userAgent: navigator.userAgent, host: window.location.hostname });
  try {
    const kept = sessionStorage.getItem(SOURCE_KEY);
    if (kept && found === "direct") return kept;
    sessionStorage.setItem(SOURCE_KEY, found);
  } catch {}
  return found;
}

function visitId(): string | null {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.("/api/shop/track", new Blob([body], { type: "application/json" }))) return;
  } catch {}
  fetch("/api/shop/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

/**
 * Statistiques de la boutique : une visite à l'ouverture, puis les clics sur les éléments marqués
 * data-track="whatsapp" ou data-track="produit" (avec data-product). Anonyme, sans cookie.
 */
export function ShopTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const sid = visitId();
    const source = visitSource();
    send({ slug, kind: "visite", sid, source });
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-track]") as HTMLElement | null;
      if (!el) return;
      send({ slug, kind: el.dataset.track, productId: el.dataset.product, sid, source });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);
  return null;
}
