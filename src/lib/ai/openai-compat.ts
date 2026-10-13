/**
 * Fournisseurs d'IA « compatibles OpenAI » (même format d'API) : DeepSeek, Mistral, OpenAI,
 * OpenRouter, Groq… Choisis par variables d'environnement, sans changer le code :
 *   AI_PROVIDER = deepseek | mistral | openai | openrouter | groq   (préréglage d'adresse et de modèle)
 *   AI_API_KEY  = clé du fournisseur
 *   AI_MODEL    = modèle (facultatif, sinon celui du préréglage)
 *   AI_BASE_URL = adresse de l'API (facultatif, pour un autre fournisseur compatible)
 * Les requêtes et réponses restent au format interne (celui de Gemini) : ce module traduit dans
 * les deux sens, outils (function calling) compris. Pur et testé.
 */
import type { GeminiContent, GeminiPart, GeminiRequest } from "./gemini";

export const PRESETS: Record<string, { baseUrl: string; model: string; label: string }> = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", label: "DeepSeek" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", label: "Mistral" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", label: "OpenAI" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-chat", label: "OpenRouter" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", label: "Groq" },
};

export function openAiConfig(env: Record<string, string | undefined> = process.env) {
  const key = env.AI_API_KEY?.trim();
  if (!key) return null;
  const provider = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const preset = PRESETS[provider];
  const baseUrl = (env.AI_BASE_URL?.trim() || preset?.baseUrl || "").replace(/\/$/, "");
  const model = env.AI_MODEL?.trim() || preset?.model || "";
  if (!baseUrl || !model) return null;
  return { key, baseUrl, model, provider: preset?.label ?? (provider || "compatible OpenAI") };
}

type OAMessage =
  | { role: "system" | "user"; content: string | { type: string; text?: string; image_url?: { url: string } }[] }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Requête interne → corps « chat/completions ». */
export function toOpenAiBody(req: GeminiRequest, model: string): Record<string, unknown> {
  const messages: OAMessage[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  // Les appels d'outils n'ont pas d'identifiant côté Gemini : on en fabrique un par position,
  // et chaque réponse d'outil reprend l'identifiant de l'appel du même nom, dans l'ordre.
  let pending: { id: string; name: string }[] = [];
  req.contents.forEach((c, i) => {
    if (c.role === "model") {
      const text = c.parts.map((p) => ("text" in p && !p.thought ? p.text : "")).join("");
      const calls = c.parts.flatMap((p, j) => ("functionCall" in p ? [{ id: `call_${i}_${j}`, name: p.functionCall.name, args: p.functionCall.args ?? {} }] : []));
      pending = calls.map((x) => ({ id: x.id, name: x.name }));
      messages.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls.map((x) => ({ id: x.id, type: "function" as const, function: { name: x.name, arguments: JSON.stringify(x.args) } })) } : {}) });
      return;
    }
    const results = c.parts.flatMap((p) => ("functionResponse" in p ? [p.functionResponse] : []));
    for (const r of results) {
      const k = pending.findIndex((x) => x.name === r.name);
      const id = k >= 0 ? pending.splice(k, 1)[0].id : `call_${i}_${r.name}`;
      messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify(r.response).slice(0, 60_000) });
    }
    const textParts = c.parts.filter((p): p is Extract<GeminiPart, { text: string }> => "text" in p);
    const images = c.parts.filter((p): p is Extract<GeminiPart, { inlineData: unknown }> => "inlineData" in p);
    if (images.some((p) => !p.inlineData.mimeType.startsWith("image/"))) throw new Error("Média non pris en charge par ce fournisseur (vocal)");
    if (images.length) {
      messages.push({ role: "user", content: [...textParts.map((p) => ({ type: "text", text: p.text })), ...images.map((p) => ({ type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } }))] });
    } else if (textParts.length) {
      messages.push({ role: "user", content: textParts.map((p) => p.text).join("\n") });
    }
  });
  const reasoning = /^(o\d|gpt-5)/.test(model);
  return {
    model,
    messages,
    ...(req.tools?.length ? { tools: req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters ?? { type: "object", properties: {} } } })) } : {}),
    ...(reasoning ? {} : { temperature: req.temperature ?? 0.2 }),
    [reasoning ? "max_completion_tokens" : "max_tokens"]: req.maxOutputTokens ?? 1024,
    ...(req.json ? { response_format: { type: "json_object" } } : {}),
  };
}

/** Réponse « chat/completions » → contenu interne (texte et appels d'outils). */
export function fromOpenAiResponse(data: unknown): GeminiContent {
  const msg = (data as { choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] })?.choices?.[0]?.message;
  const parts: GeminiPart[] = [];
  if (msg?.content) parts.push({ text: msg.content });
  for (const tc of msg?.tool_calls ?? []) {
    if (!tc.function?.name) continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}");
    } catch {
      args = {};
    }
    parts.push({ functionCall: { name: tc.function.name, args } });
  }
  return { role: "model", parts };
}
