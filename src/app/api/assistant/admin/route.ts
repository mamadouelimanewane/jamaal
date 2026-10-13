import { askAssistant } from "@/lib/actions/assistant";

/** Assistant du back-office en fetch (adresse stable d'un déploiement à l'autre). */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { history?: unknown } | null;
  try {
    return Response.json(await askAssistant(Array.isArray(body?.history) ? body.history : []));
  } catch (e) {
    const auth = e instanceof Error && /authentifi|session|réservé/i.test(e.message);
    if (!auth) console.error("[assistant] route", e);
    return Response.json({ ok: false, error: auth ? "Session expirée : reconnectez-vous." : "Une erreur est survenue, réessayez." });
  }
}
