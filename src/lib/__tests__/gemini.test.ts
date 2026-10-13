import { test } from "node:test";
import assert from "node:assert/strict";
import { generateContent, resetGeminiCooldown, thinkingVariants, type GeminiContent } from "../ai/gemini";

process.env.GOOGLE_AI_API_KEY = "test-key";

type Call = { url: string; body: { generationConfig: Record<string, unknown> }; headers: Record<string, string> };

function fakeFetch(responses: { status: number; body: unknown }[], calls: Call[]): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    const r = responses.shift()!;
    const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(text, { status: r.status });
  }) as unknown as typeof fetch;
}

const OK = { candidates: [{ content: { role: "model", parts: [{ text: "pensée", thought: true }, { text: "Bonjour" }] } }] };

test("la réflexion est limitée et la clé passe par l'en-tête", async () => {
  process.env.GEMINI_MODEL = "modele-a";
  const calls: Call[] = [];
  const out = await generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }], thinking: "minimal" }, fakeFetch([{ status: 200, body: OK }], calls));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.generationConfig.thinkingConfig, { thinkingLevel: "minimal" });
  assert.equal(calls[0].headers["x-goog-api-key"], "test-key");
  assert.ok(!calls[0].url.includes("test-key"));
  assert.equal(out.parts.length, 2);
});

test("un modèle qui refuse thinkingLevel est réessayé avec thinkingBudget, puis mémorisé", async () => {
  process.env.GEMINI_MODEL = "modele-b";
  const calls: Call[] = [];
  const refus = { status: 400, body: { error: { message: 'Invalid JSON payload received. Unknown name "thinkingLevel" at generation_config.thinking_config' } } };
  await generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }], thinking: "low" }, fakeFetch([refus, { status: 200, body: OK }], calls));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].body.generationConfig.thinkingConfig, { thinkingBudget: 512 });
  // Appel suivant : directement la variante acceptée.
  await generateContent({ contents: [{ role: "user", parts: [{ text: "y" }] }], thinking: "low" }, fakeFetch([{ status: 200, body: OK }], calls));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2].body.generationConfig.thinkingConfig, { thinkingBudget: 512 });
});

test("en dernier recours, l'appel part sans réglage de réflexion", async () => {
  process.env.GEMINI_MODEL = "modele-c";
  const calls: Call[] = [];
  const refus = { status: 400, body: "thinking config not supported" };
  await generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }], thinking: "minimal" }, fakeFetch([refus, refus, { status: 200, body: OK }], calls));
  assert.equal(calls.length, 3);
  assert.equal(calls[2].body.generationConfig.thinkingConfig, undefined);
});

test("une autre erreur n'est pas réessayée", async () => {
  process.env.GEMINI_MODEL = "modele-d";
  const calls: Call[] = [];
  await assert.rejects(
    generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }], thinking: "low" }, fakeFetch([{ status: 403, body: "API key not valid" }], calls)),
    /Gemini 403/
  );
  assert.equal(calls.length, 1);
});

test("variantes de réflexion", () => {
  assert.deepEqual(thinkingVariants(undefined), [null]);
  assert.equal(thinkingVariants("low").length, 3);
});

test("quota épuisé (429) : bascule sur le modèle de secours, puis directement pendant 1 min", async () => {
  process.env.GEMINI_MODEL = "modele-e";
  delete process.env.GEMINI_FALLBACK_MODEL;
  resetGeminiCooldown();
  const calls: Call[] = [];
  const quota = { status: 429, body: "RESOURCE_EXHAUSTED" };
  await generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }] }, fakeFetch([quota, { status: 200, body: OK }], calls));
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /modele-e:/);
  assert.match(calls[1].url, /gemini-flash-lite-latest:/);
  // Appel suivant : plus d'essai sur le modèle saturé.
  await generateContent({ contents: [{ role: "user", parts: [{ text: "y" }] }] }, fakeFetch([{ status: 200, body: OK }], calls));
  assert.equal(calls.length, 3);
  assert.match(calls[2].url, /gemini-flash-lite-latest:/);
  resetGeminiCooldown();
});

test("après une bascule, les signatures de réflexion de l'autre modèle sont neutralisées", async () => {
  process.env.GEMINI_MODEL = "modele-f";
  resetGeminiCooldown();
  const calls: Call[] = [];
  const call = { functionCall: { name: "etat_stock", args: {} }, thoughtSignature: "sig-modele-f" };
  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: "x" }] },
    { role: "model", parts: [call] },
    { role: "user", parts: [{ functionResponse: { name: "etat_stock", response: {} } }] },
  ];
  await generateContent({ contents }, fakeFetch([{ status: 503, body: "overloaded" }, { status: 200, body: OK }], calls));
  const sent = (calls[1].body as unknown as { contents: { parts: { thoughtSignature?: string }[] }[] }).contents;
  assert.equal(sent[1].parts[0].thoughtSignature, "skip_thought_signature_validator");
  // La conversation d'origine n'est pas modifiée.
  assert.equal(call.thoughtSignature, "sig-modele-f");
  resetGeminiCooldown();
});

test("sans modèle de secours, le 429 remonte", async () => {
  process.env.GEMINI_MODEL = "modele-g";
  process.env.GEMINI_FALLBACK_MODEL = "none";
  resetGeminiCooldown();
  const calls: Call[] = [];
  await assert.rejects(generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }] }, fakeFetch([{ status: 429, body: "quota" }], calls)), /Gemini 429/);
  assert.equal(calls.length, 1);
  delete process.env.GEMINI_FALLBACK_MODEL;
});

test("chaîne de secours : modèle saturé puis modèle retiré → le suivant répond", async () => {
  process.env.GEMINI_MODEL = "modele-h";
  delete process.env.GEMINI_FALLBACK_MODEL;
  resetGeminiCooldown();
  const calls: Call[] = [];
  await generateContent({ contents: [{ role: "user", parts: [{ text: "x" }] }] }, fakeFetch([{ status: 503, body: "high demand" }, { status: 404, body: "no longer available" }, { status: 200, body: OK }], calls));
  assert.deepEqual(calls.map((c) => c.url.match(/models\/([^:]+):/)?.[1]), ["modele-h", "gemini-flash-lite-latest", "gemini-3-flash-preview"]);
  resetGeminiCooldown();
});
