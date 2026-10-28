import { test } from "node:test";
import assert from "node:assert/strict";
import { isPayLinkOrder, payLinkMessage, payLinkUrl, PAY_LINK_REF } from "../pay-link";

test("lien de paiement : adresse, reconnaissance et message", () => {
  assert.equal(payLinkUrl("https://www.jamaal.sn/", "abc"), "https://www.jamaal.sn/commande/abc");
  assert.equal(PAY_LINK_REF, "lien");
  assert.equal(isPayLinkOrder({ channel: "REVENDEUR", paymentMethod: "WAVE" }), true);
  assert.equal(isPayLinkOrder({ channel: "REVENDEUR", paymentMethod: "ORANGE_MONEY" }), true);
  assert.equal(isPayLinkOrder({ channel: "REVENDEUR", paymentMethod: "WALLET" }), false);
  assert.equal(isPayLinkOrder({ channel: "SITE", paymentMethod: "WAVE" }), false);
  const m = payLinkMessage({ customerName: "Awa Diop", total: 16300, url: "https://x/commande/abc", seller: "Moussa", ref: "AB12CD34" });
  assert.match(m, /^Bonjour Awa,/);
  assert.match(m, /16 300 F CFA/);
  assert.match(m, /https:\/\/x\/commande\/abc/);
});
