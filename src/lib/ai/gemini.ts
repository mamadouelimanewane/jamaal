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
}

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

  const body: Record<string, unknown> = {
    contents: req.contents,
    generationConfig: {
      temperature: req.temperature ?? 0.2,
      maxOutputTokens: req.maxOutputTokens ?? 1024,
      ...(req.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (req.system) body.system_instruction = { parts: [{ text: req.system }] };
  if (req.tools?.length) body.tools = [{ function_declarations: req.tools }];

  const res = await fetchImpl(`${GEMINI_BASE_URL}/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new GeminiError(`Gemini ${res.status} : ${detail}`);
  }
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
