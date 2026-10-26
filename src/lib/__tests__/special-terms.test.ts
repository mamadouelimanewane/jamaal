import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedCollect, collectedLabel, collectRef, collectRefusal, paymentLine, parsePct, parseZones, withSpecialRates, zonesFromText, zonesToText } from "../special-terms";

const base = { active: true, collectMethods: [] as string[], creditLimit: 0, sellerPct: null, level1Pct: null, level2Pct: null, zones: [] };
const rates = { scenario: "CONSULTANT", seller: 18, level1: 3, level2: 2 };

test("taux : normaux sans conditions, remplacés seulement là où un taux propre est donné", () => {
  assert.deepEqual(withSpecialRates(rates, null), { ...rates, special: false });
  const r = withSpecialRates(rates, { ...base, sellerPct: 25 });
  assert.equal(r.seller, 25);
  assert.equal(r.level1, 3);
  assert.equal(r.level2, 2);
  assert.equal(r.special, true);
  assert.equal(withSpecialRates(rates, { ...base, level1Pct: 0 }).level1, 0, "0 % est un taux propre, pas « normal »");
  assert.equal(withSpecialRates(rates, { ...base, active: false, sellerPct: 25 }).seller, 18, "conditions désactivées");
});

test("encaissement direct : seulement les moyens cochés, et rien si désactivé", () => {
  assert.deepEqual(allowedCollect({ ...base, collectMethods: ["WAVE", "ESPECES", "BITCOIN"] }), ["ESPECES", "WAVE"]);
  assert.deepEqual(allowedCollect({ ...base, active: false, collectMethods: ["WAVE"] }), []);
  assert.deepEqual(allowedCollect(null), []);
});

test("plafond d'argent à reverser", () => {
  assert.equal(collectRefusal(0, 50_000, 100_000), null);
  assert.equal(collectRefusal(-60_000, 40_000, 100_000), null, "pile au plafond");
  assert.match(collectRefusal(-60_000, 40_001, 100_000)!, /déjà 60\s000 F encaissés/);
  assert.equal(collectRefusal(30_000, 30_000, 0), null, "le solde positif du wallet couvre la vente");
  assert.match(collectRefusal(10_000, 30_000, 0)!, /plafond d'argent à reverser est de 0 F/);
});

test("zones : saisie ligne par ligne, doublons et lignes invalides", () => {
  const { zones, errors } = zonesFromText("Thiès centre ; 1 500\nMbour: 2500 F\n\nthiès centre ; 9\nTouba - 3000\nn'importe quoi");
  assert.deepEqual(zones, [{ name: "Thiès centre", fee: 1500 }, { name: "Mbour", fee: 2500 }, { name: "Touba", fee: 3000 }]);
  assert.equal(errors.length, 1);
  assert.deepEqual(parseZones(zonesToText(zones).split("\n").map((l) => ({ name: l.split(" ; ")[0], fee: Number(l.split(" ; ")[1]) }))), zones);
  assert.deepEqual(parseZones("pas du json"), []);
  assert.deepEqual(parseZones([{ name: "", fee: 1 }, { name: "A", fee: -2 }, { name: "B", fee: "1000" }]), [{ name: "B", fee: 1000 }]);
});

test("pourcentages saisis", () => {
  assert.equal(parsePct(""), null);
  assert.equal(parsePct("12,5 %"), 12.5);
  assert.equal(parsePct("0"), 0);
  assert.equal(parsePct("80"), "invalid");
  assert.equal(parsePct("abc"), "invalid");
});

test("libellé de paiement", () => {
  assert.equal(collectedLabel(collectRef("ESPECES")), "Espèces (encaissé par le revendeur)");
  assert.equal(collectedLabel("wallet"), null);
  assert.equal(paymentLine({ paymentMethod: "WALLET", paymentStatus: "PAYE", paymentRef: "encaisse:WAVE" }), "Wave (encaissé par le revendeur) · payé");
  assert.equal(paymentLine({ paymentMethod: "A_LA_LIVRAISON", paymentStatus: "EN_ATTENTE" }), "À la livraison · en attente");
});
