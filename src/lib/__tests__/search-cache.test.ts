import { test } from "node:test";
import assert from "node:assert/strict";
import { createVersionedCache } from "../search-cache";

function setup() {
  let t = 0;
  let ver = "v1";
  let data = ["a"];
  let versionCalls = 0;
  const cache = createVersionedCache({
    load: async () => [...data],
    version: async () => {
      versionCalls += 1;
      return ver;
    },
    checkEveryMs: 1000,
    now: () => t,
  });
  return {
    cache,
    tick: (ms: number) => (t += ms),
    change: (v: string, d: string[]) => ((ver = v), (data = d)),
    calls: () => versionCalls,
  };
}

test("construit l'index une seule fois tant que la base ne change pas", async () => {
  const s = setup();
  assert.deepEqual(await s.cache.get(), ["a"]);
  s.tick(5000);
  await s.cache.get();
  assert.equal(s.cache.stats().builds, 1);
});

test("reconstruit dès que l'empreinte de la base change (temps réel)", async () => {
  const s = setup();
  await s.cache.get();
  s.change("v2", ["a", "b"]);
  s.tick(1000);
  assert.deepEqual(await s.cache.get(), ["a", "b"]);
  assert.equal(s.cache.stats().builds, 2);
});

test("au plus une lecture d'empreinte par seconde pendant la frappe", async () => {
  const s = setup();
  await s.cache.get();
  for (let i = 0; i < 10; i++) {
    s.tick(50);
    await s.cache.get();
  }
  assert.equal(s.calls(), 1);
});

test("invalidate force la vérification immédiate", async () => {
  const s = setup();
  await s.cache.get();
  s.change("v2", ["z"]);
  s.cache.invalidate();
  assert.deepEqual(await s.cache.get(), ["z"]);
});

test("requêtes simultanées : une seule reconstruction", async () => {
  const s = setup();
  const r = await Promise.all([s.cache.get(), s.cache.get(), s.cache.get()]);
  assert.equal(r.length, 3);
  assert.equal(s.cache.stats().builds, 1);
});
