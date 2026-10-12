/**
 * Lien personnel « donnez votre avis » envoyé après la livraison : jeton dérivé du secret du site
 * et du numéro de commande (sans base de données). Seul le client qui a reçu le lien peut noter.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "jamaal-dev-secret";
}

export function reviewToken(orderId: string): string {
  return createHmac("sha256", secret()).update(`avis:${orderId}`).digest("hex").slice(0, 20);
}

export function checkReviewToken(orderId: string, token: string | null | undefined): boolean {
  if (!token || token.length !== 20) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(reviewToken(orderId));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const reviewLink = (origin: string, orderId: string) => `${origin}/avis/${orderId}?t=${reviewToken(orderId)}`;
