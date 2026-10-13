import { test } from "node:test";
import assert from "node:assert/strict";
import { fromOpenAiResponse, openAiConfig, toOpenAiBody } from "../ai/openai-compat";
import { generateContent, resetGeminiCooldown, type GeminiContent } from "../ai/gemini";
import { runChat } from "../ai/assistant";

test("préréglages : DeepSeek, Mistral, adresse et modèle personnalisés", () => {
  assert.deepEqual(openAiConfig({ AI_PROVIDER: "deepseek", AI_API_KEY: "k" }), { key: "k", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", provider: "DeepSeek" });
  assert.equal(openAiConfig({ AI_PROVIDER: "mistral", AI_API_KEY: "k", AI_MODEL: "mistral-medium-latest" })?.model, "mistral-medium-latest");
  assert.equal(openAiConfig({ AI_BASE_URL: "https://x.ai/v1/", AI_API_KEY: "k", AI_MODEL: "m" })?.baseUrl, "https://x.ai/v1");
  assert.equal(openAiConfig({ AI_PROVIDER: "deepseek" }), null);
});

test("traduction : système, outils, appels et réponses d'outils appariés par identifiant", () => {
  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: "Stock d'Aqua Soul ?" }] },
    { role: "model", parts: [{ functionCall: { name: "etat_stock", args: { produit: "Aqua Soul" } } }, { functionCall: { name: "rechercher_produits", args: { requete: "aqua" } } }] },
    { role: "user", parts: [{ functionResponse: { name: "rechercher_produits", response: { n: 1 } } }, { functionResponse: { name: "etat_stock", response: { stock: 7 } } }] },
  ];
  const body = toOpenAiBody({ system: "Tu es l'assistant.", contents, tools: [{ name: "etat_stock", description: "d" }], maxOutputTokens: 500 }, "deepseek-chat") as { messages: { role: string; tool_call_id?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }[]; tools: unknown[]; max_tokens: number };
  assert.equal(body.messages[0].role, "system");
  const calls = body.messages[2].tool_calls!;
  assert.equal(calls[0].function.arguments, '{"produit":"Aqua Soul"}');
  assert.equal(body.messages[3].tool_call_id, calls[1].id);
  assert.equal(body.messages[4].tool_call_id, calls[0].id);
  assert.equal(body.max_tokens, 500);
  assert.equal(body.tools.length, 1);
  assert.throws(() => toOpenAiBody({ contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/ogg", data: "x" } }] }] }, "m"), /vocal/);
});

test("réponse : texte et appels d'outils (arguments JSON abîmés tolérés)", () => {
  const out = fromOpenAiResponse({ choices: [{ message: { content: "Je regarde.", tool_calls: [{ function: { name: "etat_stock", arguments: '{"produit":"Aqua"}' } }, { function: { name: "x", arguments: "{oups" } }] } }] });
  assert.deepEqual(out.parts, [{ text: "Je regarde." }, { functionCall: { name: "etat_stock", args: { produit: "Aqua" } } }, { functionCall: { name: "x", args: {} } }]);
});

const okOA = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const okGem = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text }] } }] }), { status: 200 });

test("fournisseur compatible OpenAI en premier ; s'il échoue, Gemini prend le relais", async () => {
  Object.assign(process.env, { AI_PROVIDER: "deepseek", AI_API_KEY: "k", GOOGLE_AI_API_KEY: "g" });
  resetGeminiCooldown();
  const urls: string[] = [];
  let first = true;
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    if (url.includes("deepseek")) return first ? ((first = false), okOA("Bonjour depuis DeepSeek")) : new Response("quota", { status: 429 });
    return okGem("Bonjour depuis Gemini");
  }) as unknown as typeof fetch;
  const a = await generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }] }, fetchImpl);
  assert.equal((a.parts[0] as { text: string }).text, "Bonjour depuis DeepSeek");
  const b = await generateContent({ contents: [{ role: "user", parts: [{ text: "y" }] }] }, fetchImpl);
  assert.equal((b.parts[0] as { text: string }).text, "Bonjour depuis Gemini");
  // Fournisseur en panne : écarté une minute, Gemini directement.
  await generateContent({ contents: [{ role: "user", parts: [{ text: "z" }] }] }, fetchImpl);
  assert.equal(urls.filter((u) => u.includes("deepseek")).length, 2);
  resetGeminiCooldown();
  for (const k of ["AI_PROVIDER", "AI_API_KEY", "GOOGLE_AI_API_KEY"]) delete process.env[k];
});

test("assistant complet avec DeepSeek seul : appel d'outil puis réponse", async () => {
  Object.assign(process.env, { AI_PROVIDER: "deepseek", AI_API_KEY: "k" });
  delete process.env.GOOGLE_AI_API_KEY;
  resetGeminiCooldown();
  let round = 0;
  const generate = (req: Parameters<typeof generateContent>[0]) =>
    generateContent(req, (async (_u: string, init: RequestInit) => {
      round++;
      const body = JSON.parse(String(init.body));
      if (round === 1) return new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: "t1", function: { name: "rechercher_produits", arguments: '{"requete":"cadeau homme"}' } }] } }] }), { status: 200 });
      assert.equal(body.messages.at(-1).role, "tool");
      return okOA("Je vous propose Deep Blue (28 700 FCFA).");
    }) as unknown as typeof fetch);
  const res = await runChat({ system: "s", tools: [{ name: "rechercher_produits", description: "d" }], exec: async () => ({ resultat: { produits: [{ nom: "Deep Blue" }] } }), history: [{ role: "user", text: "Un cadeau pour mon DG ?" }], generate });
  assert.equal(res.text, "Je vous propose Deep Blue (28 700 FCFA).");
  assert.deepEqual(res.toolsUsed, ["rechercher_produits"]);
  for (const k of ["AI_PROVIDER", "AI_API_KEY"]) delete process.env[k];
});
