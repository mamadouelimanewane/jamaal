import { test } from "node:test";
import assert from "node:assert/strict";
import { explainWaveError } from "../payment/wave-errors";

test("erreurs Wave expliquées : liste blanche d'IP, clé refusée, permission, validation", () => {
  const ip = explainWaveError(403, JSON.stringify({ code: "ip-not-allowed", message: "Request from IP address (3.87.5.74) not in allowlist" }));
  assert.equal(ip.code, "ip-not-allowed");
  assert.match(ip.cause, /adresses IP/);
  assert.match(ip.fix, /retirez la restriction/);
  assert.match(explainWaveError(401, '{"code":"invalid-auth"}').cause, /ne reconnaît pas la clé/);
  assert.match(explainWaveError(403, '{"code":"missing-permission"}').cause, /Checkout/);
  assert.match(explainWaveError(400, '{"code":"request-validation-error","message":"amount"}').cause, /refusé/);
  assert.equal(explainWaveError(502, "oops").code, "502");
});
