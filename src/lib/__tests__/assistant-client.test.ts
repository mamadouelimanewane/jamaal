import { test } from "node:test";
import assert from "node:assert/strict";
import { askAssistantApi } from "../assistant-client";

test("assistant : une coupure réseau est réessayée une fois, puis message clair", async () => {
  let calls = 0;
  const flaky = (async () => {
    calls++;
    if (calls === 1) throw new TypeError("Failed to fetch");
    return Response.json({ ok: true, text: "Bonjour !" });
  }) as typeof fetch;
  assert.deepEqual(await askAssistantApi("/api/assistant/boutique", [{ role: "user", text: "x" }], flaky), { ok: true, text: "Bonjour !" });
  assert.equal(calls, 2);

  let n = 0;
  const down = (async () => { n++; return new Response("", { status: 504 }); }) as typeof fetch;
  assert.deepEqual(await askAssistantApi("/x", [], down), { ok: false, error: "La réponse a pris trop de temps, réessayez." });
  assert.equal(n, 2);

  const limited = (async () => new Response("", { status: 429 })) as typeof fetch;
  assert.match((await askAssistantApi("/x", [], limited) as { error: string }).error, /patientez/);
  const refused = (async () => Response.json({ ok: false, error: "Question vide." })) as typeof fetch;
  assert.deepEqual(await askAssistantApi("/x", [], refused), { ok: false, error: "Question vide." });
});

test("Gemini : modèle principal trop lent → le modèle de secours répond", async () => {
  const { generateContent, resetGeminiCooldown } = await import("../ai/gemini");
  process.env.GOOGLE_AI_API_KEY = "test";
  delete process.env.GEMINI_FALLBACK_MODEL;
  delete process.env.GEMINI_MODEL;
  resetGeminiCooldown();
  const models: string[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    const lite = url.includes("flash-lite");
    models.push(lite ? "secours" : "principal");
    if (lite) return Promise.resolve(Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "Réponse du secours" }] } }] }));
    return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
  }) as unknown as typeof fetch;
  const keepAlive = setInterval(() => {}, 1_000); // les minuteries d'AbortSignal ne retiennent pas le processus
  const out = await generateContent({ contents: [{ role: "user", parts: [{ text: "gestion WhatsApp" }] }], timeoutMs: 8_000 }, fetchImpl);
  assert.equal(out.parts.map((p) => ("text" in p ? p.text : "")).join(""), "Réponse du secours");
  clearInterval(keepAlive);
  assert.deepEqual(models, ["principal", "secours"]);
  resetGeminiCooldown();
  delete process.env.GOOGLE_AI_API_KEY;
});
