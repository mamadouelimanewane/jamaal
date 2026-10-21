import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUSINESS_MODEL } from "../business-model";
import { commissionRatesText, DEFAULT_PROTOCOL_TEXT, DEFAULT_PROTOCOL_VERSION, LEGACY_RATES_BLOCK, normalizeProtocol, withRates } from "../protocol";

test("protocole : l'article 8 reprend les taux du modèle économique, pas des taux écrits en dur", () => {
  assert.ok(DEFAULT_PROTOCOL_TEXT.includes("{taux_commissions}"));
  assert.ok(!DEFAULT_PROTOCOL_TEXT.includes(LEGACY_RATES_BLOCK));
  const lines = commissionRatesText(DEFAULT_BUSINESS_MODEL);
  const m = DEFAULT_BUSINESS_MODEL;
  assert.ok(lines.includes(`Vente d'un Leader : ${m.sellerLeaderPct} % au Leader`));
  assert.ok(lines.includes(`Vente d'un Parrain : ${m.sellerParrainPct} % au Parrain, ${m.sponsorAlonePct} % au Leader`));
  assert.ok(lines.includes(`${m.sellerPct} % au Consultant, ${m.sponsorSharedPct} % à son Parrain, ${m.grandSponsorPct} % au Leader`));
  const text = withRates(DEFAULT_PROTOCOL_TEXT, lines);
  assert.ok(!text.includes("{taux_commissions}"));
});

test("protocole : un taux décimal s'écrit à la française", () => {
  const lines = commissionRatesText({ ...DEFAULT_BUSINESS_MODEL, grandSponsorPct: 2.5 });
  assert.ok(lines.includes("2,5 % au Leader"));
});

test("protocole : le texte par défaut passe en version 2 (la v1 avait les anciens taux)", () => {
  assert.equal(normalizeProtocol(null).version, DEFAULT_PROTOCOL_VERSION);
  assert.equal(normalizeProtocol({ version: 1 }).version, DEFAULT_PROTOCOL_VERSION);
  const custom = "x".repeat(250);
  assert.equal(normalizeProtocol({ version: 1, text: custom }).version, 1);
});
