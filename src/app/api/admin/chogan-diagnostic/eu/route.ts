import { requireAdminForApi } from "@/lib/api-guard";
import { choganDiagnostic } from "@/lib/chogan/diagnostic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Même test depuis l'Europe (Francfort), au cas où Chogan filtre les serveurs américains. */
export const preferredRegion = "fra1";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  return Response.json(await choganDiagnostic("europe (fra1)"));
}
