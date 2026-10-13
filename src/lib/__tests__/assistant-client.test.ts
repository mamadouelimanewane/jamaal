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
