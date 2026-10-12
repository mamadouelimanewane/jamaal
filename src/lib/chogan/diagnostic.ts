/**
 * Diagnostic d'accès au site Chogan depuis le serveur : essaie plusieurs jeux d'en-têtes et
 * renvoie, pour chacun, le code HTTP et les indices utiles (serveur, protection anti-robots).
 * Sert à comprendre un refus (403) en production. Lecture seule.
 */
import { BROWSER_HEADERS, LEGACY_HEADERS } from "./client";

const URLS = ["https://www.chogangroupspa.com/chogangroup/productDetail/9479", "https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg"];

export async function choganDiagnostic(region: string) {
  const variants: Record<string, Record<string, string>> = { navigateur: BROWSER_HEADERS, ancien: LEGACY_HEADERS, aucun: {} };
  const results = [];
  for (const url of URLS) {
    for (const [name, headers] of Object.entries(variants)) {
      const t = Date.now();
      try {
        const res = await fetch(url, { headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10_000) });
        const body = res.headers.get("content-type")?.includes("text") ? (await res.text()).replace(/\s+/g, " ") : "";
        results.push({
          url: url.replace(/^https:\/\//, "").slice(0, 60),
          entetes: name,
          statut: res.status,
          ms: Date.now() - t,
          serveur: res.headers.get("server"),
          cloudflare: res.headers.get("cf-ray"),
          type: res.headers.get("content-type"),
          redirection: res.headers.get("location"),
          titre: body.match(/<title>(.*?)<\/title>/i)?.[1]?.slice(0, 120) ?? null,
          ficheTrouvee: /id="id_art"/.test(body),
          extrait: res.ok ? null : body.slice(0, 300),
        });
      } catch (e) {
        results.push({ url, entetes: name, erreur: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t });
      }
    }
  }
  return { region, vercelRegion: process.env.VERCEL_REGION ?? null, resultats: results };
}
