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
  | { functionResponse: { name: string; response: Record<string, unknown> } };

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

/** Appelle generateContent et renvoie le contenu du premier candidat. */
export async function generateContent(req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<GeminiContent> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new GeminiError("GOOGLE_AI_API_KEY manquante");

  const model = geminiModel();
  const signal = AbortSignal.timeout(req.timeoutMs ?? 20_000);
  const variants = thinkingVariants(req.thinking);
  const memo = `${model}|${req.thinking ?? ""}`;

  let res: Response | null = null;
  for (let v = acceptedVariant.get(memo) ?? 0; v < variants.length; v++) {
    const thinkingConfig = variants[v];
    const body: Record<string, unknown> = {
      contents: req.contents,
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 1024,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    };
    if (req.system) body.system_instruction = { parts: [{ text: req.system }] };
    if (req.tools?.length) body.tools = [{ function_declarations: req.tools }];

    res = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) {
      acceptedVariant.set(memo, v);
      break;
    }
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // Réglage de réflexion inconnu de ce modèle : on essaie la variante suivante.
    if (res.status === 400 && thinkingConfig && /thinking/i.test(detail) && v < variants.length - 1) continue;
    throw new GeminiError(`Gemini ${res.status} : ${detail}`);
  }
  if (!res?.ok) throw new GeminiError("Gemini : aucune réponse");
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
