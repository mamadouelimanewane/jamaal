/**
 * Service worker de l'application consultant (installable). Servi sous /admin/sw.js pour que sa
 * portée soit /admin/. Il ne met AUCUNE donnée en cache (les pages contiennent des chiffres de
 * vente à jour) : il affiche seulement une page « hors connexion » si le réseau est coupé.
 *
 * Important : on n'intercepte que les navigations GET (simple affichage de page). Les
 * formulaires de connexion / changement de mot de passe envoient un POST : intercepter ce POST
 * et le ré-émettre via fetch(event.request) est beaucoup moins fiable sur mobile (le corps de la
 * requête n'est pas toujours re-transmissible selon le navigateur), et la moindre micro-coupure
 * réseau (fréquente en 4G) bascule alors sur la page « hors connexion » au lieu de traiter la
 * connexion — donnant l'impression que « la connexion ne marche pas » sur smartphone alors que
 * tout fonctionne sur un réseau wifi plus stable. Laisser ces requêtes passer directement au
 * réseau, sans passer par le service worker.
 */
const SW = `
const OFFLINE_URL = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("jamaal-offline-v1").then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
