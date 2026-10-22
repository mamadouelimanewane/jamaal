import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { waveVerdict, type WaveSession } from "../payment/settle-wave";
import { verifyWaveSignature } from "../payment/wave-signature";
import { paymentGateway, versusConfigured, versusCredentials } from "../payment/versus";

const S = (o: Partial<WaveSession> = {}): WaveSession => ({ id: "cos-1", amount: "16300", currency: "XOF", client_reference: "ord1", checkout_status: "complete", payment_status: "succeeded", ...o });

test("Wave direct : seule une session payée de la même commande valide le paiement", () => {
  assert.equal(waveVerdict(S(), "ord1"), "paid");
  assert.equal(waveVerdict(S({ client_reference: "autre" }), "ord1"), "unknown");
  assert.equal(waveVerdict(S({ currency: "EUR" }), "ord1"), "unknown");
  assert.equal(waveVerdict(S({ checkout_status: "open", payment_status: "processing" }), "ord1"), "pending");
  assert.equal(waveVerdict(S({ checkout_status: "expired", payment_status: "cancelled" }), "ord1"), "failed");
  assert.equal(waveVerdict(null, "ord1"), "unknown");
});

test("Wave : signature des webhooks (format t=…,v1=…, plusieurs v1, rejeu refusé)", () => {
  const secret = "wave_sn_WHS_test";
  const body = '{"type":"checkout.session.completed"}';
  const t = 1_800_000_000;
  const sig = createHmac("sha256", secret).update(`${t}${body}`).digest("hex");
  assert.ok(verifyWaveSignature(body, `t=${t},v1=${sig}`, secret, t + 10));
  assert.ok(verifyWaveSignature(body, `t=${t},v1=deadbeef,v1=${sig}`, secret, t + 10));
  assert.ok(!verifyWaveSignature(body + " ", `t=${t},v1=${sig}`, secret, t + 10));
  assert.ok(!verifyWaveSignature(body, `t=${t},v1=${sig}`, "autre", t + 10));
  assert.ok(!verifyWaveSignature(body, `t=${t},v1=${sig}`, secret, t + 3600), "message rejoué une heure plus tard");
  const plain = createHmac("sha256", secret).update(body).digest("hex");
  assert.ok(verifyWaveSignature(body, plain, secret));
});

test("Passerelle : PAYMENT_GATEWAY=direct met Versus en pause sans oublier ses identifiants", () => {
  const keep = { ...process.env };
  try {
    Object.assign(process.env, { VERSUS_BASE_URL: "https://v", VERSUS_LOGIN: "l", VERSUS_PASSWORD: "p" });
    delete process.env.PAYMENT_GATEWAY;
    assert.equal(paymentGateway(), "versus");
    assert.ok(versusConfigured());
    process.env.PAYMENT_GATEWAY = "direct";
    assert.equal(paymentGateway(), "direct");
    assert.ok(!versusConfigured(), "nouveaux paiements hors Versus");
    assert.ok(versusCredentials(), "anciens paiements Versus toujours vérifiables");
  } finally {
    process.env = keep;
  }
});
