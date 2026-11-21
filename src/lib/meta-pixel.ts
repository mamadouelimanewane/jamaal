/**
 * Pixel Meta (Facebook / Instagram) de JAMAAL Luxury.
 * Identifiant public (il figure dans le code de chaque page) : la variable NEXT_PUBLIC_META_PIXEL_ID le remplace si besoin.
 */
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || "1883184059376286").trim();

export type MetaEvent = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";
type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    /** Événements envoyés avant le chargement du pixel : rejoués dès qu'il est prêt. */
    __jamaalMetaQueue?: unknown[][];
  }
}

/** Envoie un événement au pixel ; s'il n'est pas encore chargé (arrivée depuis une publicité), il est mis en attente. */
export function trackMeta(event: MetaEvent, data: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined") return;
  const args = ["track", event, { currency: "XOF", content_type: "product", ...data }, ...(eventId ? [{ eventID: eventId }] : [])];
  if (window.fbq) window.fbq(...args);
  else (window.__jamaalMetaQueue ??= []).push(args);
}
