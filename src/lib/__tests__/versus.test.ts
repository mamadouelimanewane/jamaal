import { test } from "node:test";
import assert from "node:assert/strict";
import { createVersusPayment, externalReferenceFor, getVersusPayment, orderIdFromReference, splitName, versusConfigured } from "../payment/versus";

test("nom du client coupé en prénom et nom", () => {
  assert.deepEqual(splitName("Awa Diop Ndiaye"), { first: "Awa", last: "Diop Ndiaye" });
  assert.deepEqual(splitName("Awa"), { first: "Awa", last: "Awa" });
  assert.deepEqual(splitName("  "), { first: "Client", last: "JAMAAL" });
});

test("la référence externe garde l'identifiant de commande et reste unique", () => {
  const a = externalReferenceFor("cmabc123");
  assert.equal(orderIdFromReference(a), "cmabc123");
  assert.notEqual(a, externalReferenceFor("cmabc123"));
  assert.equal(orderIdFromReference("wdep_x1~ab12"), "wdep_x1");
});

test("création et relecture d'un paiement Versus (serveur simulé)", async () => {
  process.env.VERSUS_BASE_URL = "https://versus.test";
  process.env.VERSUS_LOGIN = "l";
  process.env.VERSUS_PASSWORD = "p";
  assert.ok(versusConfigured());
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (url.endsWith("/api/auth/login")) return json({ data: { access_token: "T", expires_in: 3600 } });
    if (url.endsWith("/api/services")) return json({ data: [{ id: 13, code: "X", service_type: { code: "CARD_PAYMENT" } }] });
    if (url.endsWith("/api/payment")) return json({ data: { link: "https://versus.test/pay/abc", payment_reference: "abc" } }, 202);
    if (url.endsWith("/api/payment/abc")) return json({ data: { payment: { status: "COMPLETED", amount: 100, currency: "XOF", external_reference: "o1~zz" } } });
    return json({}, 404);
  }) as typeof fetch;
  try {
    const base = { orderId: "o1", amount: 100, customerName: "Awa Diop", successUrl: "s", cancelUrl: "c" };
    const choice = await createVersusPayment({ ...base, channel: "choice" });
    assert.deepEqual(choice, { url: "https://versus.test/pay/abc", paymentReference: "abc" });
    // Versus refuse les retours non https : ils sont omis, jamais envoyés.
    const b0 = calls.find((c) => c.url.endsWith("/api/payment"))?.body;
    assert.equal(b0?.success_url, undefined);
    await createVersusPayment({ ...base, successUrl: "https://x.sn/ok", cancelUrl: "http://localhost/no", channel: "choice" });
    const b1 = calls.filter((c) => c.url.endsWith("/api/payment")).at(-1)?.body;
    assert.equal(b1?.success_url, "https://x.sn/ok");
    assert.equal(b1?.failure_url, undefined);
    assert.equal(calls.find((c) => c.url.endsWith("/api/payment"))?.body?.service_id, undefined);
    await createVersusPayment({ ...base, channel: "card" });
    assert.equal(calls.filter((c) => c.url.endsWith("/api/payment")).at(-1)?.body?.service_id, 13);
    assert.deepEqual(await getVersusPayment("abc"), { status: "COMPLETED", amount: 100, currency: "XOF", externalReference: "o1~zz" });
    assert.equal(await getVersusPayment("nope"), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
