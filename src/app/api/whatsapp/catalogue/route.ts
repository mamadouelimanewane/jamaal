import { timingSafeEqual } from "node:crypto";
import { getSiteUrl } from "@/lib/site-url";
import { catalogCsv } from "@/lib/whatsapp/catalog";

/**
 * Flux du catalogue pour WhatsApp (Meta Commerce Manager > Catalogue > Sources de données >
 * Flux de données programmé) : https://<domaine>/api/whatsapp/catalogue
 */
export const dynamic = "force-dynamic";

/**
 * Le flux contient tout le catalogue : il n'est servi qu'au robot de Meta, ou avec la clé
 * CATALOG_FEED_TOKEN (à ajouter à l'adresse du flux chez Meta : ...?token=...). L'équipe le télécharge
 * depuis Admin > Centre WhatsApp.
 */
export async function GET(req: Request) {
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  const isMeta = /facebookexternalhit|facebookcatalog|facebot/.test(ua);
  const expected = process.env.CATALOG_FEED_TOKEN;
  const given = new URL(req.url).searchParams.get("token") ?? "";
  const tokenOk = !!expected && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!isMeta && !tokenOk) return new Response("Accès refusé.", { status: 403, headers: { "Cache-Control": "no-store" } });
  const csv = await catalogCsv(await getSiteUrl());
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, max-age=3600" } });
}
