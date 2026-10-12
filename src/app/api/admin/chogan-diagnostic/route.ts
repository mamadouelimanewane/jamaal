import { requireAdminForApi } from "@/lib/api-guard";
import { choganDiagnostic } from "@/lib/chogan/diagnostic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/admin/chogan-diagnostic : accès au site Chogan depuis la région par défaut du serveur. */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  return Response.json(await choganDiagnostic("défaut"));
}
