import { test } from "node:test";
import assert from "node:assert/strict";

const model = { acceptWave: true, acceptOrangeMoney: true, acceptCard: false, acceptCashOnDelivery: false };

test("Versus configuré : Wave, Orange Money et carte sont proposés séparément, selon le modèle économique", async () => {
  process.env.VERSUS_BASE_URL = "https://versus.test";
  process.env.VERSUS_LOGIN = "l";
  process.env.VERSUS_PASSWORD = "p";
  const { getAvailablePaymentProviders } = await import("../payment");
  assert.deepEqual(getAvailablePaymentProviders(model).map((p) => p.id), ["wave", "orange_money"]);
  assert.deepEqual(getAvailablePaymentProviders({ ...model, acceptCard: true }).map((p) => p.id), ["wave", "orange_money", "stripe"]);
  const none = { acceptWave: false, acceptOrangeMoney: false, acceptCard: false, acceptCashOnDelivery: false };
  assert.deepEqual(getAvailablePaymentProviders(none).map((p) => p.id), ["cod"]);
});
