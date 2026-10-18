import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUSINESS_MODEL, normalizeBusinessModel, sellerRateFor, sponsorRatesFor } from "../business-model";

const m = DEFAULT_BUSINESS_MODEL;
const part = (base: number, pct: number) => Math.round((base * pct) / 100);

test("règles du 18 octobre : Leader 20 %, Parrain 19 %, Consultant 18 % sur leurs propres ventes", () => {
  assert.equal(sellerRateFor("Leader", m), 20);
  assert.equal(sellerRateFor("Parrain", m), 19);
  assert.equal(sellerRateFor("Consultant", m), 18);
});

test("le filleul (Consultant) vend : lui 18 %, son Parrain 4 %, le Leader 2 %", () => {
  const rates = sponsorRatesFor(true, m); // le parrain direct a lui-même un parrain (le Leader)
  assert.equal(rates.level1, 4);
  assert.equal(rates.level2, 2);
  const base = 28_700;
  assert.deepEqual([part(base, sellerRateFor("Consultant", m)), part(base, rates.level1), part(base, rates.level2)], [5166, 1148, 574]);
});

test("le Parrain vend : lui 19 %, le Leader 6 %", () => {
  const rates = sponsorRatesFor(false, m); // le parrain direct de la vente (le Leader) n'a personne au-dessus
  assert.equal(rates.level1, 6);
  assert.equal(part(10_000, sellerRateFor("Parrain", m)), 1900);
  assert.equal(part(10_000, rates.level1), 600);
});

test("modèle enregistré avant les rangs : les nouvelles règles s'appliquent, puis les valeurs enregistrées priment", () => {
  const legacy = normalizeBusinessModel({ sellerPct: 18, sponsorSharedPct: 3, grandSponsorPct: 3, sponsorAlonePct: 6 });
  assert.equal(legacy.sellerLeaderPct, 20);
  assert.equal(legacy.sellerParrainPct, 19);
  assert.equal(legacy.sponsorSharedPct, 4);
  assert.equal(legacy.grandSponsorPct, 2);
  // Une fois enregistré avec les champs par rang, les valeurs choisies ne sont plus remplacées.
  const saved = normalizeBusinessModel({ sellerLeaderPct: 21, sellerParrainPct: 17, sponsorSharedPct: 5, grandSponsorPct: 1 });
  assert.equal(saved.sellerLeaderPct, 21);
  assert.equal(saved.sellerParrainPct, 17);
  assert.equal(saved.sponsorSharedPct, 5);
  assert.equal(saved.grandSponsorPct, 1);
});
