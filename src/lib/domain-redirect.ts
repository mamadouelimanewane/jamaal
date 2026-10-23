/**
 * Ancienne adresse jamaal-nine.vercel.app → domaine officiel www.jamaal.sn (redirection permanente).
 * Seulement les pages consultées (GET / HEAD) : les webhooks (Wave, Meta, Versus), les tâches et les
 * appels d'API restent servis sur l'ancienne adresse, rien ne casse pendant la transition. Pur, testé.
 */
export const LEGACY_HOSTS = ["jamaal-nine.vercel.app"];
export const OFFICIAL_HOST = "www.jamaal.sn";

export function legacyRedirect(host: string | null, method: string, pathname: string, search: string): string | null {
  if (!host || !LEGACY_HOSTS.includes(host.toLowerCase().split(":")[0])) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname === "/admin/sw.js") return null;
  return `https://${OFFICIAL_HOST}${pathname}${search}`;
}
