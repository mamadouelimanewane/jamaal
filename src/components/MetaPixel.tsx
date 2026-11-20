"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window { fbq?: (...args: unknown[]) => void; _fbq?: (...args: unknown[]) => void }
}

export function MetaPixel({ pixelId }: { pixelId?: string }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pixelId || !pathname) return;
    if (lastPath.current !== null && window.fbq) window.fbq("track", "PageView");
    lastPath.current = pathname;
  }, [pathname, pixelId]);
  if (!pixelId || !/^\d{5,30}$/.test(pixelId)) return null;
  return <>
    <Script id="meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/fr_FR/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');` }} />
    <noscript><img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} alt="" /></noscript>
  </>;
}

export function MetaPixelEvent({ event, productId, productIds, value, eventId }: { event: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase"; productId?: string; productIds?: string[]; value?: number; eventId?: string }) {
  useEffect(() => {
    if (!window.fbq) return;
    if (event === "Purchase" && eventId) {
      try { if (sessionStorage.getItem(`jamaal-meta-purchase:${eventId}`)) return; } catch {}
    }
    window.fbq("track", event, { content_ids: productIds ?? (productId ? [productId] : undefined), content_type: "product", value, currency: "XOF" }, eventId ? { eventID: eventId } : undefined);
    if (event === "Purchase" && eventId) { try { sessionStorage.setItem(`jamaal-meta-purchase:${eventId}`, "1"); } catch {} }
  }, [event, productId, productIds, value, eventId]);
  return null;
}
