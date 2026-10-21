import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptanceMessage, acceptanceWhatsAppUrl } from "../acceptance-message";

const base = { name: "Ibrahima Faye", sponsorName: "Moussa Sarr", activationUrl: "https://x/admin/reset-password?token=t", shopUrl: "https://x/c/ibrahima" };

test("acceptation : le numéro sénégalais saisi en local passe au format international", () => {
  const url = acceptanceWhatsAppUrl({ ...base, phone: "77 444 55 66" })!;
  assert.ok(url.startsWith("https://wa.me/221774445566?text="));
  assert.ok(acceptanceWhatsAppUrl({ ...base, phone: "+221 77 444 55 66" })!.startsWith("https://wa.me/221774445566?"));
});

test("acceptation : le message contient le prénom, le parrain, le lien d'activation et le lien de vente", () => {
  const m = acceptanceMessage(base);
  assert.ok(m.startsWith("Bonjour Ibrahima,"));
  assert.ok(m.includes("l'équipe de Moussa Sarr"));
  assert.ok(m.includes(base.activationUrl));
  assert.ok(m.includes(base.shopUrl));
});

test("acceptation : sans numéro exploitable, pas de lien", () => {
  assert.equal(acceptanceWhatsAppUrl({ ...base, phone: "12" }), undefined);
});
