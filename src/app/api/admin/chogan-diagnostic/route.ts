import { requireAdminForApi } from "@/lib/api-guard";
import { choganDiagnostic } from "@/lib/chogan/diagnostic";
import { fetchChoganDetail, fetchChoganImage, searchChogan } from "@/lib/chogan/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/admin/chogan-diagnostic : accès au site Chogan depuis la région par défaut du serveur. */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const direct = await choganDiagnostic("fonction serveur (accès direct)");
  // Chemin réellement utilisé par l'import (relais edge en ligne).
  const t = Date.now();
  const relais = await Promise.all([
    fetchChoganDetail(9479).then((d) => ({ fiche: d ? `${d.code} ${d.name} — ${d.shade ?? ""} · ${d.publicPriceEur} € · ${d.images.length} photos` : "introuvable" })),
    searchChogan("MM061").then((c) => ({ recherche: c.map((x) => `${x.code} ${x.name}`).slice(0, 5) })),
    fetchChoganImage("https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg").then((i) => ({ photo: `${i.contentType} ${Math.round(i.data.length / 1024)} Ko` })),
  ].map((p) => p.catch((e) => ({ erreur: e instanceof Error ? e.message : String(e) }))));
  return Response.json({ relais: { ms: Date.now() - t, resultats: relais }, direct });
}
