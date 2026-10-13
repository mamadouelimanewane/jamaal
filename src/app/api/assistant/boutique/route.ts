import { askShopAssistant } from "@/lib/actions/shop-assistant";

/**
 * Conseillère du site, appelée en fetch plutôt qu'en action serveur : une adresse fixe continue
 * de répondre après un redéploiement (une page ouverte avant le déploiement gardait un
 * identifiant d'action périmé → « Connexion perdue »).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { history?: unknown } | null;
  try {
    return Response.json(await askShopAssistant(Array.isArray(body?.history) ? body.history : []));
  } catch (e) {
    console.error("[assistant boutique] route", e);
    return Response.json({ ok: false, error: "Une erreur est survenue, réessayez." });
  }
}
