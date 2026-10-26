import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { payoutProvidersConfig, sendPayout, wavePayoutKeySource } from "../payouts/providers";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
const reply = (status: number, body: unknown) => {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
};
const req = { reference: "tx_1", amount: 5000, mobile: "+221771234567", name: "Awa" };

beforeEach(() => {
  calls = [];
  delete process.env.WAVE_PAYOUT_API_KEY;
  process.env.WAVE_API_KEY = "cle-paiement";
});

test("clé : la clé des paiements sert aux versements à défaut de clé dédiée", async () => {
  assert.equal(payoutProvidersConfig().WAVE, true);
  assert.equal(wavePayoutKeySource(), "paiement");
  reply(200, { id: "pt-1", status: "succeeded" });
  assert.deepEqual(await sendPayout("WAVE", req), { status: "VERSE", providerRef: "pt-1" });
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Bearer cle-paiement");
  assert.equal(h["idempotency-key"], "tx_1", "pas de double versement si on relance");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { currency: "XOF", receive_amount: "5000", mobile: "+221771234567", name: "Awa", client_reference: "tx_1", payment_reason: "Commissions JAMAAL" });
  process.env.WAVE_PAYOUT_API_KEY = "cle-payout";
  assert.equal(wavePayoutKeySource(), "dediee");
  await sendPayout("WAVE", req);
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer cle-payout");
});

test("problème du compte JAMAAL : la demande reste en attente (BLOQUE), elle n'échoue pas", async () => {
  reply(403, { code: "missing-auth-scope", message: "API key lacks payout permission" });
  assert.equal((await sendPayout("WAVE", req)).status, "BLOQUE");
  reply(400, { code: "insufficient-funds", message: "Insufficient balance" });
  assert.equal((await sendPayout("WAVE", req)).status, "BLOQUE");
  reply(200, { id: "pt-2", status: "failed", payout_error: { error_code: "insufficient-funds", reason: "Not enough balance" } });
  assert.equal((await sendPayout("WAVE", req)).status, "BLOQUE");
});

test("problème du destinataire : échec, le montant revient sur le wallet du membre", async () => {
  reply(200, { id: "pt-3", status: "failed", payout_error: { error_code: "recipient-not-found", reason: "Recipient has no Wave account" } });
  assert.deepEqual(await sendPayout("WAVE", req), { status: "ECHEC", providerRef: "pt-3", error: "Recipient has no Wave account" });
  reply(400, { code: "invalid-mobile", message: "Invalid mobile number" });
  assert.equal((await sendPayout("WAVE", req)).status, "ECHEC");
});

test("en cours : accepté par Wave, confirmé plus tard", async () => {
  reply(200, { id: "pt-4", status: "processing" });
  assert.deepEqual(await sendPayout("WAVE", req), { status: "EN_COURS", providerRef: "pt-4" });
});

test("solde Wave Business et fin de clé", async () => {
  const { waveBusinessBalance, wavePayoutKeyTail } = await import("../payouts/providers");
  process.env.WAVE_PAYOUT_API_KEY = "wave_sn_prod_abcdlTmA";
  assert.equal(wavePayoutKeyTail(), "lTmA");
  reply(200, { amount: "125000", currency: "XOF" });
  assert.equal(await waveBusinessBalance(), 125000);
  assert.equal(calls.at(-1)!.url, "https://api.wave.com/v1/balance");
  reply(403, { message: "no balance scope" });
  assert.equal(await waveBusinessBalance(), null);
});
