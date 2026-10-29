import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceRefusal, couponLink, couponMessage, generateCode } from "../coupon-audience";

test("codes promo : génération lisible, préfixe selon la cible", () => {
  let i = 0;
  const code = generateCode("CLIENT", () => i++ % 31);
  assert.match(code, /^CLI-[A-Z2-9]{6}$/);
  assert.match(generateCode("TOUS_VENDEURS"), /^PRO-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
});

test("codes promo : cible respectée", () => {
  const client = { audience: "CLIENT", targetPhone: "+221 77 670 09 96", targetConsultantId: null };
  assert.equal(audienceRefusal(client), null, "aperçu sans téléphone");
  assert.equal(audienceRefusal(client, { phone: "776700996" }), null);
  assert.match(audienceRefusal(client, { phone: "771112233" }) ?? "", /réservé/);
  const seller = { audience: "VENDEUR", targetPhone: null, targetConsultantId: "c1" };
  assert.equal(audienceRefusal(seller, { consultantId: "c1" }), null);
  assert.ok(audienceRefusal(seller, { consultantId: "c2" }));
  assert.equal(audienceRefusal(seller, { consultantId: null }), null, "sans conseiller : attribué au vendeur du code");
  const allSellers = { audience: "TOUS_VENDEURS", targetPhone: null, targetConsultantId: null };
  assert.equal(audienceRefusal(allSellers, { consultantId: "c9" }), null);
  assert.ok(audienceRefusal(allSellers, { consultantId: null }));
  assert.equal(audienceRefusal({ audience: "TOUS_CLIENTS", targetPhone: null, targetConsultantId: null }, { consultantId: null, phone: "1" }), null);
});

test("codes promo : lien et message", () => {
  assert.equal(couponLink("https://www.jamaal.sn/", "CLI-ABC234"), "https://www.jamaal.sn/panier?code=CLI-ABC234");
  assert.equal(couponLink("https://www.jamaal.sn", "VEN-ABC234", "moussa"), "https://www.jamaal.sn/panier?code=VEN-ABC234&ref=moussa");
  const m = couponMessage({ audience: "CLIENT", name: "Awa Diop", code: "CLI-ABC234", kind: "POURCENTAGE", value: 10, link: "https://x/panier?code=CLI-ABC234" });
  assert.match(m, /Bonjour Awa/);
  assert.match(m, /\*CLI-ABC234\* \(-10 %\)/);
  assert.match(couponMessage({ audience: "VENDEUR", name: "Moussa", code: "VEN-X", kind: "MONTANT_FIXE", value: 2000, link: "l" }), /pour vos clients[\s\S]*-2 000 F CFA/);
});
