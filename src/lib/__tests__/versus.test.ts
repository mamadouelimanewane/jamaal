import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createVersusPayment,
  directLink,
  externalReferenceFor,
  getVersusPayment,
  isVersusRef,
  linkPolling,
  orderIdFromReference,
  rawVersusRef,
  splitName,
  toSenegalNumber,
  versusConfigured,
} from "../payment/versus";

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

test("numéro sénégalais mis au format international", () => {
  assert.equal(toSenegalNumber("77 123 45 67"), "+221771234567");
  assert.equal(toSenegalNumber("+221 77 123 45 67"), "+221771234567");
  assert.equal(toSenegalNumber("00221771234567".slice(2)), "+221771234567");
  assert.equal(toSenegalNumber("0771234567"), "+221771234567");
  assert.equal(toSenegalNumber("12345"), null);
  assert.equal(toSenegalNumber(null), null);
  assert.equal(toSenegalNumber("+33612345678"), null);
});

test("lien direct choisi selon le moyen de paiement, https uniquement", () => {
  const links = { WAVE: "https://pay.wave.com/c/x?a=5000", OM: "https://sugu.orange-sonatel.com/mp/y", CARD_PAYMENT: "https://paypage.test/?code=z" };
  assert.equal(directLink("wave", links), links.WAVE);
  assert.equal(directLink("orange_money", links), links.OM);
  assert.equal(directLink("orange_money", { MAXIT: "https://sugu.orange-sonatel.com/mp/m" }), "https://sugu.orange-sonatel.com/mp/m");
  assert.equal(directLink("card", links), links.CARD_PAYMENT);
  assert.equal(directLink("wave", { WAVE: "http://pas-https" }), null);
  assert.equal(directLink("wave", null), null);
});

test("Wave : le numéro déjà saisi est transmis et le client est envoyé directement vers Wave", async () => {
  process.env.VERSUS_BASE_URL = "https://versus.test";
  process.env.VERSUS_LOGIN = "l";
  process.env.VERSUS_PASSWORD = "p";
  assert.ok(versusConfigured());
  linkPolling.tries = 3;
  linkPolling.delayMs = 1;
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  let reads = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (url.endsWith("/api/auth/login")) return json({ data: { access_token: "T", expires_in: 3600 } });
    if (url.endsWith("/api/services")) {
      return json({
        data: [
          { id: 3, code: "SN_WAVE_PAYMENT_ONLINE", service_type: { code: "PAYMENT" } },
          { id: 4, code: "SN_ORANGE_MONEY_PAYMENT_ONLINE", service_type: { code: "PAYMENT" } },
          { id: 13, code: "SN_ORABANK_NGENIUS_PAYMENT_ONLINE", service_type: { code: "CARD_PAYMENT" } },
        ],
      });
    }
    if (url.endsWith("/api/payment")) return json({ data: { link: "https://versus.test/pay/abc", payment_reference: "abc" } }, 202);
    if (url.endsWith("/api/payment/abc")) {
      reads++;
      // Les instructions arrivent à la 2e lecture, comme chez Versus (quelques secondes après la création).
      const links = reads >= 2 ? { WAVE: "https://pay.wave.com/c/x?a=5000&c=XOF" } : null;
      return json({ data: { payment: { status: reads >= 2 ? "TRANSMITTED" : "CREATED", amount: 5000, currency: "XOF", external_reference: "o1~zz", payment_links: links } } });
    }
    return json({}, 404);
  }) as typeof fetch;
  try {
    const base = { orderId: "o1", amount: 5000, customerName: "Awa Diop", customerPhone: "77 123 45 67", successUrl: "https://x.sn/ok", cancelUrl: "https://x.sn/no" };
    const r = await createVersusPayment({ ...base, channel: "wave" });
    assert.deepEqual(r, { url: "https://pay.wave.com/c/x?a=5000&c=XOF", paymentReference: "abc", direct: true });
    const sent = calls.find((c) => c.url.endsWith("/api/payment"))?.body;
    assert.equal(sent?.service_id, 3);
    assert.equal(sent?.payment_account_number, "+221771234567");
    assert.equal(sent?.success_url, "https://x.sn/ok");

    // Orange Money : même principe avec son propre service.
    reads = 5;
    const om = await createVersusPayment({ ...base, channel: "orange_money" });
    assert.equal(calls.filter((c) => c.url.endsWith("/api/payment")).at(-1)?.body?.service_id, 4);
    // Orange Money : jamais le lien direct (il se bloque sans Max it), toujours la page Versus avec son code QR.
    assert.equal(om.direct, false);
    assert.equal(om.url, "https://versus.test/pay/abc");

    // Carte : service carte, aucun numéro de téléphone requis.
    await createVersusPayment({ ...base, customerPhone: null, channel: "card" });
    const cardBody = calls.filter((c) => c.url.endsWith("/api/payment")).at(-1)?.body;
    assert.equal(cardBody?.service_id, 13);
    assert.equal(cardBody?.payment_account_number, undefined);

    // Numéro inutilisable : pas de service imposé, le client choisit sur la page Versus.
    const fb = await createVersusPayment({ ...base, customerPhone: "12", channel: "wave" });
    assert.equal(calls.filter((c) => c.url.endsWith("/api/payment")).at(-1)?.body?.service_id, undefined);
    assert.deepEqual(fb, { url: "https://versus.test/pay/abc", paymentReference: "abc", direct: false });

    // Retours non https : omis, jamais envoyés.
    await createVersusPayment({ ...base, successUrl: "https://x.sn/ok", cancelUrl: "http://localhost/no", channel: "card" });
    const b1 = calls.filter((c) => c.url.endsWith("/api/payment")).at(-1)?.body;
    assert.equal(b1?.success_url, "https://x.sn/ok");
    assert.equal(b1?.failure_url, undefined);

    reads = 5;
    const p = await getVersusPayment("abc");
    assert.equal(p?.status, "TRANSMITTED");
    assert.equal(p?.amount, 5000);
    assert.equal(await getVersusPayment("nope"), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("les références Versus sont repérées par leur préfixe", () => {
  assert.ok(isVersusRef("versus:abc"));
  assert.ok(!isVersusRef("cs_test_123"));
  assert.ok(!isVersusRef(null));
  assert.equal(rawVersusRef("versus:abc"), "abc");
  assert.equal(rawVersusRef("abc"), "abc");
});
