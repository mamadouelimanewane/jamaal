import { requireAdminForApi } from "@/lib/api-guard";
import { GEMINI_BASE_URL, geminiFallbackModel, geminiModel } from "@/lib/ai/gemini";
import { openAiConfig, toOpenAiBody, fromOpenAiResponse } from "@/lib/ai/openai-compat";
import { whatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/ai-check : diagnostic des services externes, lecture seule.
 * - IA : un appel minimal à chaque modèle Gemini (statut HTTP, durée, début de réponse).
 * - WhatsApp : variables présentes (jamais leurs valeurs) et droits de la clé chez Meta.
 */
export async function GET(req: Request) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const key = process.env.GOOGLE_AI_API_KEY ?? "";
  // ?modeles=a,b : essayer d'autres modèles (choix d'un modèle de secours disponible).
  const extra = (new URL(req.url).searchParams.get("modeles") ?? "").split(",").map((m) => m.trim()).filter((m) => /^[\w.-]{3,60}$/.test(m)).slice(0, 6);
  const models = [...new Set([geminiModel(), geminiFallbackModel(), ...extra].filter((m): m is string => !!m))];
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
        // Quota dépassé : quel quota (par minute, par jour, offre gratuite) et quand réessayer.
        let quota: unknown = undefined;
        if (res.status === 429) {
          try {
            const details = (JSON.parse(text).error?.details ?? []) as { "@type"?: string; violations?: { quotaId?: string; quotaValue?: string }[]; retryDelay?: string }[];
            quota = {
              limites: details.flatMap((d) => d.violations ?? []).map((v) => `${v.quotaId} (${v.quotaValue ?? "?"})`),
              reessayerDans: details.find((d) => d.retryDelay)?.retryDelay ?? null,
            };
          } catch {
            quota = null;
          }
        }
        return { model, status: res.status, ms: Date.now() - started, extrait: text.slice(0, 220), quota };
      } catch (e) {
        return { model, status: 0, ms: Date.now() - started, erreur: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e) };
      }
    })
  );

  // Fournisseur compatible OpenAI (DeepSeek, Mistral, OpenAI…), avec un outil pour vérifier le function calling.
  const oa = openAiConfig();
  let fournisseur: Record<string, unknown> | null = null;
  if (oa) {
    const started = Date.now();
    try {
      const body = toOpenAiBody({ contents: [{ role: "user", parts: [{ text: "Quel est le stock du parfum Aqua Soul ? Utilise l'outil." }] }], tools: [{ name: "etat_stock", description: "Stock d'un produit", parameters: { type: "object", properties: { produit: { type: "string" } }, required: ["produit"] } }], maxOutputTokens: 100 }, oa.model);
      const res = await fetch(`${oa.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${oa.key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
      const text = await res.text();
      let outil: unknown = null;
      try {
        outil = fromOpenAiResponse(JSON.parse(text)).parts.find((p) => "functionCall" in p) ?? null;
      } catch {}
      fournisseur = { nom: oa.provider, modele: oa.model, status: res.status, ms: Date.now() - started, outilAppele: outil, extrait: res.ok ? undefined : text.slice(0, 220) };
    } catch (e) {
      fournisseur = { nom: oa.provider, modele: oa.model, status: 0, ms: Date.now() - started, erreur: e instanceof Error ? e.message : String(e) };
    }
  }

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
    ia: { cle: key ? `présente (${key.length} caractères)` : "absente", modeles: ai, fournisseur },
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
