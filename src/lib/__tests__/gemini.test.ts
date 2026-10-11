import { test } from "node:test";
import assert from "node:assert/strict";
import { generateContent, thinkingVariants } from "../ai/gemini";

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
