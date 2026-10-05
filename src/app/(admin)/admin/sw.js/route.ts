/**
 * Service worker de l'application revendeur (installable). Servi sous /admin/sw.js pour que sa
 * portée soit /admin/. Il ne met AUCUNE donnée en cache (les pages contiennent des chiffres de
 * vente à jour) : il affiche seulement une page « hors connexion » si le réseau est coupé.
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
  if (event.request.mode !== "navigate") return;
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
