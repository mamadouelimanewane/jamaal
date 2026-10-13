import { requireAdminForApi } from "@/lib/api-guard";
import { GEMINI_BASE_URL, geminiFallbackModel, geminiModel } from "@/lib/ai/gemini";
import { whatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/ai-check : diagnostic des services externes, lecture seule.
 * - IA : un appel minimal à chaque modèle Gemini (statut HTTP, durée, début de réponse).
 * - WhatsApp : variables présentes (jamais leurs valeurs) et droits de la clé chez Meta.
 */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const key = process.env.GOOGLE_AI_API_KEY ?? "";
  const models = [geminiModel(), geminiFallbackModel()].filter((m): m is string => !!m);
  const ai = await Promise.all(
    models.map(async (model) => {
      const started = Date.now();
      try {
        const res = await fetch(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Réponds OK." }] }], generationConfig: { maxOutputTokens: 20 } }),
          signal: AbortSignal.timeout(20_000),
        });
        const text = await res.text();
        return { model, status: res.status, ms: Date.now() - started, extrait: text.slice(0, 220) };
      } catch (e) {
        return { model, status: 0, ms: Date.now() - started, erreur: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e) };
      }
    })
  );

  const wa = whatsappConfig();
  const present = (k: string) => Boolean(process.env[k]);
  let meta: Record<string, unknown> | null = null;
  if (present("WHATSAPP_TOKEN") && present("WHATSAPP_PHONE_NUMBER_ID")) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`, {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const err = body.error as { message?: string; code?: number } | undefined;
      meta = res.ok ? { ok: true, numero: body.display_phone_number, nom: body.verified_name } : { ok: false, code: err?.code ?? res.status, message: err?.message?.slice(0, 200) };
    } catch (e) {
      meta = { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  return Response.json({
    ia: { cle: key ? `présente (${key.length} caractères)` : "absente", modeles: ai },
    whatsapp: {
      fournisseur: wa.provider,
      envoiActif: wa.active,
      webhookPret: wa.webhookReady,
      variables: Object.fromEntries(["WHATSAPP_PROVIDER", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_TEMPLATE_NAME", "NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER", "CRON_SECRET"].map((k) => [k, present(k) ? "présente" : "ABSENTE"])),
      cleMeta: meta,
    },
    region: process.env.VERCEL_REGION ?? null,
  });
}
