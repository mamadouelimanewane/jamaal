"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID, trackMeta, type MetaEvent } from "@/lib/meta-pixel";

/** Pixel Meta sur toutes les pages : PageView au chargement puis à chaque changement de page. */
export function MetaPixel({ pixelId = META_PIXEL_ID }: { pixelId?: string }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pixelId || !pathname) return;
    if (lastPath.current !== null && lastPath.current !== pathname && window.fbq) window.fbq("track", "PageView");
    lastPath.current = pathname;
  }, [pathname, pixelId]);
  if (!pixelId || !/^\d{5,30}$/.test(pixelId)) return null;
  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/fr_FR/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');(window.__jamaalMetaQueue||[]).splice(0).forEach(function(a){fbq.apply(null,a)});`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} alt="" />
      </noscript>
    </>
  );
}

/** Événement Meta au montage du composant (fiche produit, panier, confirmation de commande). */
export function MetaPixelEvent({ event, productId, productIds, value, eventId, numItems }: { event: MetaEvent; productId?: string; productIds?: string[]; value?: number; eventId?: string; numItems?: number }) {
  useEffect(() => {
    if (event === "Purchase" && eventId) {
      try {
        if (sessionStorage.getItem(`jamaal-meta-purchase:${eventId}`)) return;
        sessionStorage.setItem(`jamaal-meta-purchase:${eventId}`, "1");
      } catch {}
    }
    trackMeta(event, { content_ids: productIds ?? (productId ? [productId] : undefined), value, ...(numItems ? { num_items: numItems } : {}) }, eventId);
  }, [event, productId, productIds, value, eventId, numItems]);
  return null;
}
