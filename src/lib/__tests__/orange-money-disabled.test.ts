import { test } from "node:test";
import assert from "node:assert/strict";
import { orangeMoneyProvider } from "../payment/providers/orange-money";
import { POST as orangeWebhook } from "../../app/api/payment/orange/webhook/route";

test("les anciens paramètres Orange Money génériques ne rendent pas le paiement disponible", async () => {
  const keys = [
    "ORANGE_MONEY_CLIENT_ID",
    "ORANGE_MONEY_CLIENT_SECRET",
    "ORANGE_MONEY_MERCHANT_KEY",
    "ORANGE_MONEY_PAYMENT_URL",
    "ORANGE_MONEY_WEBHOOK_SECRET",
  ];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const gateway = process.env.PAYMENT_GATEWAY;
  const versus = ["VERSUS_BASE_URL", "VERSUS_LOGIN", "VERSUS_PASSWORD"].map((key) => [key, process.env[key]] as const);
  try {
    delete process.env.PAYMENT_GATEWAY;
    for (const [key] of versus) delete process.env[key];
    process.env.ORANGE_MONEY_CLIENT_ID = "legacy-client";
    process.env.ORANGE_MONEY_CLIENT_SECRET = "legacy-secret";
    process.env.ORANGE_MONEY_MERCHANT_KEY = "legacy-merchant";
    process.env.ORANGE_MONEY_PAYMENT_URL = "https://example.invalid/pay";
    process.env.ORANGE_MONEY_WEBHOOK_SECRET = "legacy-webhook";

    assert.equal(orangeMoneyProvider.available, false);
    await assert.rejects(
      orangeMoneyProvider.createPayment({
        orderId: "order-test",
        amount: 1000,
        customerName: "Test",
        successUrl: "https://jamaal.sn/success",
        cancelUrl: "https://jamaal.sn/cancel",
      }),
      /Kwingo 2 doit être validée/
    );
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    if (gateway === undefined) delete process.env.PAYMENT_GATEWAY;
    else process.env.PAYMENT_GATEWAY = gateway;
    for (const [key, value] of versus) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("le webhook Orange Money non implémenté refuse un faux statut de paiement", async () => {
  const response = await orangeWebhook();
  assert.equal(response.status, 503);
  assert.match(await response.text(), /pas encore activé/);
});
