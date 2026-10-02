import { headers } from "next/headers";

/**
 * URL publique du site (sans slash final), pour les liens envoyés par e-mail ou WhatsApp.
 * Priorité : NEXT_PUBLIC_SITE_URL, puis l'hôte de la requête en cours (le domaine réellement
 * utilisé par l'administrateur), et seulement en dernier recours VERCEL_URL (adresse technique
 * propre à chaque déploiement, souvent protégée).
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // hors contexte de requête
  }
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
}
