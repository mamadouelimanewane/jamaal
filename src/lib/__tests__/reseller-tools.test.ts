import { test } from "node:test";
import assert from "node:assert/strict";
import { waLink } from "../ai/reseller-tools";

test("lien WhatsApp : numéro sénégalais mis au format international, message encodé", () => {
  assert.equal(waLink("77 123 45 67"), "https://wa.me/221771234567");
  assert.equal(waLink("+221 77 123 45 67"), "https://wa.me/221771234567");
  assert.equal(waLink("00221771234567", "Bonjour Awa & merci !"), "https://wa.me/221771234567?text=Bonjour%20Awa%20%26%20merci%20!");
  assert.equal(waLink(null), null);
  assert.equal(waLink("12"), null);
});
