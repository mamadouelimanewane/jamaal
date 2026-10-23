import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUSINESS_MODEL } from "../business-model";
import { roundNice, simRates, simulateEarnings, WEEKS_PER_MONTH } from "../earnings-sim";

const rates = simRates({ ...DEFAULT_BUSINESS_MODEL, primesEnabled: false, teamPrimesEnabled: false });

test("consultant seul : commission vendeur sur ses ventes", () => {
  const r = simulateEarnings({ salesPerWeek: 5, basket: 20_000, filleuls: 0, filleulSalesPerWeek: 2 }, rates);
  assert.equal(r.title, "Consultant");
  assert.equal(r.ownRevenue, Math.round(5 * WEEKS_PER_MONTH * 20_000));
  assert.equal(r.own, Math.round((r.ownRevenue * DEFAULT_BUSINESS_MODEL.sellerPct) / 100));
  assert.equal(r.team, 0);
  assert.equal(r.monthly, r.own);
  assert.equal(r.yearly, r.monthly * 12);
});

test("avec des filleuls : taux Parrain + part sur les ventes de l'équipe", () => {
  const r = simulateEarnings({ salesPerWeek: 5, basket: 20_000, filleuls: 3, filleulSalesPerWeek: 2 }, rates);
  assert.equal(r.title, "Parrain");
  assert.equal(r.sellerRate, DEFAULT_BUSINESS_MODEL.sellerParrainPct);
  assert.equal(r.teamRevenue, Math.round(3 * 2 * WEEKS_PER_MONTH * 20_000));
  assert.equal(r.team, Math.round((r.teamRevenue * DEFAULT_BUSINESS_MODEL.sponsorSharedPct) / 100));
  assert.equal(r.monthly, r.own + r.team);
});

test("primes selon les paliers, plafond de filleuls, arrondi", () => {
  const withPrimes = simRates({ ...DEFAULT_BUSINESS_MODEL, primesEnabled: true, primeTiers: [{ threshold: 100_000, amount: 5_000 }, { threshold: 400_000, amount: 25_000 }], maxConsultantsPerParrain: 5 });
  const r = simulateEarnings({ salesPerWeek: 5, basket: 20_000, filleuls: 50, filleulSalesPerWeek: 0 }, withPrimes);
  assert.equal(r.personalPrime?.amount, 25_000);
  assert.equal(r.filleuls, 5);
  assert.equal(roundNice(123_456), 123_500);
  assert.equal(roundNice(1_234), 1_250);
});
