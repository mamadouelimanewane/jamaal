import { test } from "node:test";
import assert from "node:assert/strict";
import { placeIn } from "../topbar-rank";
import { shareMessage, estimatedGainLabel, productLink } from "../share-text";
import { findProducts } from "../product-finder";
import { DEFAULT_BUSINESS_MODEL, dispatchScenarios, normalizeBusinessModel, payoutChannels } from "../business-model";
import { fillTemplate, unknownVars, WA_MESSAGES } from "../whatsapp/message-templates-data";
import { orderMessage, orderMessageVars, type OrderEvent } from "../whatsapp/order-notify";
import { relance45Text, birthdayText, cartText } from "../automation/relances";
import { reviewRequestText } from "../automation/reviews";
import { diagnose, errorCode, groupFailures } from "../whatsapp/diagnose";
import { isPasswordRequest } from "../password-reset-link";
import { startingPrice } from "../reseller-catalog";

test("barre du haut : place au classement du mois", () => {
  assert.equal(placeIn(["a", "b", "c"], "b"), 2);
  assert.equal(placeIn(["a"], "z"), null);
});

test("partage : un produit, plusieurs produits, TikTok ; liens avec le code du revendeur", () => {
  const one = shareMessage([{ slug: "aqua", name: "Aqua Soul", price: 12500, inspiredBy: "Acqua di Gio" }], "https://j.sn", "awa");
  assert.match(one, /^Aqua Soul \(inspiré de Acqua di Gio\) — 12\s500 FCFA\. Commande ici : https:\/\/j\.sn\/produits\/aqua\?ref=awa$/);
  const many = shareMessage([{ slug: "a", name: "A", price: 1000 }, { slug: "b", name: "B" }], "https://j.sn", null);
  assert.match(many, /Ma sélection JAMAAL/);
  assert.match(many, /• A — 1\s000 FCFA : https:\/\/j\.sn\/produits\/a\n• B : https:\/\/j\.sn\/produits\/b/);
  const tiktok = shareMessage([{ slug: "a", name: "A" }], "https://j.sn", "awa", "tiktok");
  assert.match(tiktok, /https:\/\/j\.sn\/c\/awa/);
  assert.match(tiktok, /#JAMAAL/);
  assert.equal(shareMessage([], "x", null), "");
  assert.equal(productLink("o", "s", null), "o/produits/s");
});

test("gain estimé affiché sur les fiches", () => {
  assert.match(estimatedGainLabel(13000, 18), /^Vous gagnez ≈ 2\s340 F$/);
  assert.equal(estimatedGainLabel(null, 18), "");
  assert.equal(estimatedGainLabel(1000, 0), "");
});

test("prix de départ : le plus petit format, sinon le prix du produit", () => {
  assert.equal(startingPrice(20000, [{ label: "30 ml", price: 9000 }, { label: "70 ml", price: 15000 }]), 9000);
  assert.equal(startingPrice(20000, null), 20000);
  assert.equal(startingPrice(null, [{ label: "x", price: 0 }]), null);
});

test("recherche revendeur : catégorie et famille trouvent les parfums, pluriel toléré", () => {
  const products = [
    { name: "Aqua Soul", choganCode: "021M", categoryLabel: "Parfums homme", family: "Aquatique" },
    { name: "Rose Velours", choganCode: "102F", categoryLabel: "Parfums femme", family: "Florale" },
    { name: "Gel douche", choganCode: "GD1", categoryLabel: "Gels douche" },
  ];
  assert.deepEqual(findProducts(products, "parfum femme").map((p) => p.name), ["Rose Velours"]);
  assert.deepEqual(findProducts(products, "parfums").map((p) => p.name), ["Aqua Soul", "Rose Velours"]);
  assert.deepEqual(findProducts(products, "florale").map((p) => p.name), ["Rose Velours"]);
  assert.deepEqual(findProducts(products, "021m").map((p) => p.name), ["Aqua Soul"]);
});

test("répartition des ventes : chaque acteur et le total, selon le modèle", () => {
  const rows = dispatchScenarios(DEFAULT_BUSINESS_MODEL);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(byId.LEADER.parts.map((p) => p.pct), [DEFAULT_BUSINESS_MODEL.sellerLeaderPct]);
  assert.equal(byId.PARRAIN.parts.length, 2);
  assert.equal(byId.CONSULTANT.parts.length, 3);
  assert.equal(byId.CONSULTANT.total, DEFAULT_BUSINESS_MODEL.sellerPct + DEFAULT_BUSINESS_MODEL.sponsorSharedPct + DEFAULT_BUSINESS_MODEL.grandSponsorPct);
  assert.equal(byId.CONSULTANT_DIRECT.parts[1].pct, DEFAULT_BUSINESS_MODEL.leaderDirectPct);
});

test("retraits : Wave et/ou Orange Money, jamais aucun", () => {
  assert.deepEqual(payoutChannels(DEFAULT_BUSINESS_MODEL), ["WAVE", "ORANGE_MONEY"]);
  assert.deepEqual(payoutChannels({ payoutWave: false, payoutOrangeMoney: true }), ["ORANGE_MONEY"]);
  assert.deepEqual(payoutChannels({ payoutWave: false, payoutOrangeMoney: false }), ["WAVE", "ORANGE_MONEY"]);
  assert.equal(normalizeBusinessModel({ payoutWave: false }).payoutWave, false);
  assert.equal(normalizeBusinessModel({}).payoutOrangeMoney, true);
});

test("messages modifiables : variables remplies, espaces nettoyés, variables inconnues détectées", () => {
  assert.equal(fillTemplate("Bonjour {prenom} 🌸\nMerci", { prenom: "" }), "Bonjour 🌸\nMerci");
  assert.equal(fillTemplate("N° {numero} {inconnue}.", { numero: "AB" }), "N° AB .");
  assert.deepEqual(unknownVars("suivi_payee", "Merci {prenom} {prénom} {numero}"), ["prénom"]);
});

test("textes d'origine des messages modifiables = textes réellement envoyés (aucun changement tant que l'admin n'édite pas)", () => {
  const base = { id: "cmabc123xyz9", customerName: "Awa Diop", total: 25000, paymentStatus: "EN_ATTENTE", channel: "SITE", deliveryMode: "LIVRAISON_JAMAAL", depositAmount: 10000, reservationDelay: "10 jours" };
  const cases: [OrderEvent, Partial<typeof base> & { isReservation?: boolean }][] = [
    ["CREEE", {}],
    ["CREEE", { paymentStatus: "PAYE" }],
    ["CREEE", { isReservation: true }],
    ["ACOMPTE", {}],
    ["ACOMPTE", { reservationDelay: null as unknown as string }],
    ["PAYEE", {}],
    ["CONFIRMEE", {}],
    ["EXPEDIEE", {}],
    ["EXPEDIEE", { deliveryMode: "RETRAIT_REVENDEUR" }],
    ["ANNULEE", {}],
    ["LIVREE", { deliveryMode: "RETRAIT_REVENDEUR" }],
  ];
  for (const [event, over] of cases) {
    const o = { ...base, ...over };
    const original = orderMessage(event, o, "https://j.sn")!.text;
    const { key, vars } = orderMessageVars(event, o);
    assert.equal(fillTemplate(WA_MESSAGES[key].text, vars), original, `${event} ${JSON.stringify(over)}`);
  }
  const STOP = "\n\n(Répondez STOP pour ne plus recevoir ces messages.)";
  assert.equal(
    fillTemplate(WA_MESSAGES.relance45.text, { prenom: "Awa", produit: "Aqua", lien: "L", signature: "Fatou, votre conseiller·e JAMAAL" }) + STOP,
    relance45Text({ firstName: "Awa", product: "Aqua", link: "L", reseller: "Fatou" })
  );
  assert.equal(fillTemplate(WA_MESSAGES.relance45.text, { prenom: "", produit: "Aqua", lien: "L", signature: "L'équipe JAMAAL" }) + STOP, relance45Text({ firstName: "", product: "Aqua", link: "L", reseller: null }));
  assert.equal(fillTemplate(WA_MESSAGES.anniversaire.text, { prenom: "Awa", code: "C", jours: 15, lien: "O/collections" }) + STOP, birthdayText({ firstName: "Awa", code: "C", days: 15, origin: "O" }));
  assert.equal(fillTemplate(WA_MESSAGES.panier.text, { prenom: "Awa", articles: "a, b", lien: "O/panier" }) + STOP, cartText({ firstName: "Awa", items: ["a", "b"], origin: "O" }));
  assert.equal(fillTemplate(WA_MESSAGES.avis.text, { prenom: "Awa", produits: "*Aqua*", lien: "L" }) + STOP, reviewRequestText({ firstName: "Awa", products: ["Aqua"], link: "L" }));
});

test("diagnostic WhatsApp : codes Meta et anciens titres expliqués", () => {
  assert.equal(errorCode("131047 Re-engagement message"), "131047");
  assert.equal(diagnose("131047 Re-engagement message").code, "131047");
  assert.match(diagnose("Re-engagement message").fix, /WHATSAPP_TEMPLATE_NAME/);
  assert.equal(diagnose("(#131030) Recipient phone number not in allowed list").code, "131030");
  assert.equal(diagnose("190 Error validating access token").code, "190");
  assert.equal(diagnose("Numéro invalide").code, "numero");
  const g = groupFailures([
    { error: "131047 x", createdAt: new Date(1) },
    { error: "131047 y", createdAt: new Date(5) },
    { error: "190 z", createdAt: new Date(2) },
  ]);
  assert.equal(g[0].code, "131047");
  assert.equal(g[0].count, 2);
  assert.equal(g[0].last.getTime(), 5);
});

test("mot de passe oublié sur WhatsApp : demandes reconnues, le reste non", () => {
  for (const t of ["MOT DE PASSE", "mot de passe oublié", "Mdp", "J'ai oublié mon mot de passe", "réinitialiser mot de passe"]) assert.equal(isPasswordRequest(t), true, t);
  for (const t of ["Je veux commander un parfum", "le mot de passe du wifi ?", "bonjour"]) assert.equal(isPasswordRequest(t), false, t);
});
