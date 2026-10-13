import { getSiteUrl } from "@/lib/site-url";
import { catalogCsv } from "@/lib/whatsapp/catalog";

/**
 * Flux du catalogue pour WhatsApp (Meta Commerce Manager > Catalogue > Sources de données >
 * Flux de données programmé) : https://<domaine>/api/whatsapp/catalogue
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await catalogCsv(await getSiteUrl());
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
