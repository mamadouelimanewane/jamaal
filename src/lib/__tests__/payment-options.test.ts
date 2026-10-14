import { test } from "node:test";
import assert from "node:assert/strict";

const model = { acceptWave: true, acceptOrangeMoney: true, acceptCard: false, acceptCashOnDelivery: false };

test("Versus configuré : un seul paiement en ligne, le choix se fait chez Versus", async () => {
  process.env.VERSUS_BASE_URL = "https://versus.test";
  process.env.VERSUS_LOGIN = "l";
  process.env.VERSUS_PASSWORD = "p";
  process.env.WAVE_API_KEY = "x"; // même avec une clé Wave directe, Versus prime
  const { getAvailablePaymentProviders } = await import("../payment");
  assert.deepEqual(getAvailablePaymentProviders(model).map((p) => p.id), ["versus"]);
  // Aucun des moyens acceptés par le modèle économique : pas de paiement en ligne, repli sur la livraison.
  const none = { acceptWave: false, acceptOrangeMoney: false, acceptCard: false, acceptCashOnDelivery: false };
  assert.deepEqual(getAvailablePaymentProviders(none).map((p) => p.id), ["cod"]);
});
