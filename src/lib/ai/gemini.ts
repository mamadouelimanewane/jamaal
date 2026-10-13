/**
 * Client minimal de l'API Google Gemini (REST, sans dépendance).
 *
 * - Clé : GOOGLE_AI_API_KEY, envoyée dans l'en-tête x-goog-api-key (jamais dans l'URL, pour ne pas
 *   apparaître dans les journaux).
 * - Modèle : GEMINI_MODEL, par défaut l'alias « gemini-flash-latest » qui suit le dernier modèle
 *   Flash : un modèle retiré par Google ne casse plus la fonctionnalité.
 */

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export type GeminiPart =
  | { text: string; thought?: boolean; thoughtSignature?: string }
  | { functionCall: { name: string; args?: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface GeminiRequest {
  system?: string;
  contents: GeminiContent[];
  tools?: GeminiFunctionDeclaration[];
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  /**
   * Réflexion du modèle avant de répondre. Les modèles Flash récents « réfléchissent » par défaut :
   * cela coûte du temps et des jetons pris sur maxOutputTokens (réponse vide ou coupée, délai dépassé).
   * « minimal » pour une tâche simple (extraction de mots-clés), « low » pour l'assistant.
   */
  thinking?: "minimal" | "low";
}

/** Budget de réflexion équivalent pour les modèles 2.x, qui ne connaissent pas thinkingLevel. */
const THINKING_BUDGET: Record<NonNullable<GeminiRequest["thinking"]>, number> = { minimal: 0, low: 512 };

/** Variantes du réglage de réflexion, de la plus récente à aucune : la première acceptée par le modèle est gardée. */
export function thinkingVariants(level: GeminiRequest["thinking"]): (Record<string, unknown> | null)[] {
  if (!level) return [null];
  return [{ thinkingLevel: level }, { thinkingBudget: THINKING_BUDGET[level] }, null];
}

/** Variante retenue par modèle et par niveau, pour ne pas refaire les essais à chaque appel. */
const acceptedVariant = new Map<string, number>();

export class GeminiError extends Error {}

export function geminiConfigured() {
  return Boolean(process.env.GOOGLE_AI_API_KEY);
}

export function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest";
/** Secours supplémentaires, essayés dans l'ordre (un modèle saturé ou retiré passe au suivant). */
export const DEFAULT_GEMINI_FALLBACK_MODELS = [DEFAULT_GEMINI_FALLBACK_MODEL, "gemini-3-flash-preview"];

/**
 * Modèles de secours, utilisés quand le principal répond 429 (quota épuisé), 503 (surcharge),
 * 404 (modèle retiré) ou tarde trop. GEMINI_FALLBACK_MODEL accepte une liste séparée par des
 * virgules ; « none » désactive le secours.
 */
export function geminiFallbackModels(): string[] {
  const v = process.env.GEMINI_FALLBACK_MODEL?.trim();
  if (v?.toLowerCase() === "none") return [];
  const list = v ? v.split(",").map((m) => m.trim()).filter(Boolean) : DEFAULT_GEMINI_FALLBACK_MODELS;
  return [...new Set(list)].filter((m) => m !== geminiModel());
}

/** Premier modèle de secours (compatibilité). */
export function geminiFallbackModel(): string | null {
  return geminiFallbackModels()[0] ?? null;
}

/** Après un 429 / 503 du modèle principal, on passe directement au secours pendant un moment. */
const PRIMARY_COOLDOWN_MS = 60_000;
let primaryCooldownUntil = 0;
export function resetGeminiCooldown() {
  primaryCooldownUntil = 0;
}

/** Signature fictive admise par Gemini quand une conversation passe d'un modèle à un autre. */
const FOREIGN_SIGNATURE = "skip_thought_signature_validator";

class GeminiHttpError extends GeminiError {
  constructor(readonly status: number, detail: string) {
    super(`Gemini ${status} : ${detail}`);
  }
}

async function callModel(model: string, req: GeminiRequest, key: string, signal: AbortSignal, fetchImpl: typeof fetch, foreign: boolean) {
  const variants = thinkingVariants(req.thinking);
  const memo = `${model}|${req.thinking ?? ""}`;
  // Conversation commencée sur un autre modèle : ses signatures de réflexion ne valent pas ici.
  const contents = foreign
    ? req.contents.map((c) => ({ ...c, parts: c.parts.map((p) => ("thoughtSignature" in p && p.thoughtSignature ? { ...p, thoughtSignature: FOREIGN_SIGNATURE } : p)) }))
    : req.contents;

  for (let v = acceptedVariant.get(memo) ?? 0; v < variants.length; v++) {
    const thinkingConfig = variants[v];
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 1024,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    };
    if (req.system) body.system_instruction = { parts: [{ text: req.system }] };
    if (req.tools?.length) body.tools = [{ function_declarations: req.tools }];

    const res = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) {
      acceptedVariant.set(memo, v);
      return res;
    }
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // Réglage de réflexion inconnu de ce modèle : on essaie la variante suivante.
    if (res.status === 400 && thinkingConfig && /thinking/i.test(detail) && v < variants.length - 1) continue;
    throw new GeminiHttpError(res.status, detail);
  }
  throw new GeminiError("Gemini : aucune réponse");
}

/** Erreurs qui justifient d'essayer le modèle suivant. */
function retriable(e: unknown): boolean {
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return true;
  return e instanceof GeminiHttpError && [404, 429, 500, 502, 503, 504].includes(e.status);
}

/**
 * Appelle generateContent et renvoie le contenu du premier candidat. Les modèles sont essayés
 * dans l'ordre (principal, puis secours) dans le délai total : chacun a une part du temps
 * restant, le dernier a tout ce qui reste.
 */
export async function generateContent(req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<GeminiContent> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new GeminiError("GOOGLE_AI_API_KEY manquante");

  const primary = geminiModel();
  const fallbacks = geminiFallbackModels();
  const total = req.timeoutMs ?? 20_000;
  const started = Date.now();
  const hasSignatures = req.contents.some((c) => c.parts.some((p) => "thoughtSignature" in p && p.thoughtSignature));
  const skipPrimary = fallbacks.length > 0 && Date.now() < primaryCooldownUntil;
  const chain = skipPrimary ? fallbacks : [primary, ...fallbacks];

  let lastError: unknown = new GeminiError("Gemini : aucune réponse");
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const left = total - (Date.now() - started);
    if (left < 1_500) break;
    const isLast = i === chain.length - 1;
    const budget = isLast ? left : Math.max(4_000, Math.round(left * 0.55));
    // Conversation commencée sur le principal : ses signatures ne valent pas pour un autre modèle.
    const foreign = hasSignatures && model !== primary;
    try {
      try {
        return await contentOf(await callModel(model, req, key, AbortSignal.timeout(budget), fetchImpl, foreign));
      } catch (e) {
        // Signatures de réflexion refusées : on les neutralise et on réessaie ce modèle.
        if (e instanceof GeminiHttpError && e.status === 400 && hasSignatures && !foreign && /signature/i.test(e.message)) {
          return await contentOf(await callModel(model, req, key, AbortSignal.timeout(Math.max(1_000, total - (Date.now() - started))), fetchImpl, true));
        }
        throw e;
      }
    } catch (e) {
      lastError = e;
      if (!retriable(e) || isLast) throw e;
      if (model === primary) primaryCooldownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
      console.warn(`[gemini] ${model} indisponible (${e instanceof GeminiHttpError ? e.status : "délai dépassé"}), bascule sur ${chain[i + 1]}`);
    }
  }
  throw lastError;
}

async function contentOf(res: Response): Promise<GeminiContent> {
  const data = (await res.json()) as { candidates?: { content?: GeminiContent; finishReason?: string }[] };
  const content = data.candidates?.[0]?.content;
  if (!content?.parts?.length) {
    throw new GeminiError(`Réponse vide (${data.candidates?.[0]?.finishReason ?? "sans candidat"})`);
  }
  return { role: "model", parts: content.parts };
}

/** Texte visible d'une réponse (les « pensées » du modèle sont ignorées). */
export function textOf(content: GeminiContent): string {
  return content.parts
    .map((p) => ("text" in p && !p.thought ? p.text : ""))
    .join("")
    .trim();
}

/**
 * Lit un média reçu (vocal, photo) : transcription d'un message vocal ou description d'une photo,
 * pour que l'assistant le traite comme un message écrit.
 */
export async function readMedia(media: { data: Uint8Array; mimeType: string }, kind: "audio" | "image"): Promise<string> {
  const prompt =
    kind === "audio"
      ? "Transcris fidèlement ce message vocal d'un client (français, wolof ou anglais). Si c'est du wolof, donne la traduction française entre parenthèses. Réponds uniquement par la transcription."
      : "Un client d'une boutique de parfums et cosmétiques envoie cette photo. Décris en une ou deux phrases ce qu'on voit (produit, marque et nom lisibles sur l'étiquette, couleur, type de produit) pour retrouver un produit équivalent. Réponds uniquement par la description.";
  const reply = await generateContent({
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: media.mimeType, data: Buffer.from(media.data).toString("base64") } }, { text: prompt }] }],
    maxOutputTokens: 600,
    thinking: "minimal",
    timeoutMs: 20_000,
  });
  return textOf(reply).slice(0, 1200);
}
