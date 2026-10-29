import { requireAdmin } from "@/lib/actions/auth-guard";
import { fleetSnapshot } from "@/lib/tour/fleet";

export const dynamic = "force-dynamic";

/** Flotte des livreurs en direct (administrateurs avec le module Livraison). */
export async function GET() {
  try {
    await requireAdmin("livraison", "read");
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(await fleetSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
