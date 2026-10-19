import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionRatesFor, DEFAULT_BUSINESS_MODEL, normalizeBusinessModel } from "../business-model";

const m = DEFAULT_BUSINESS_MODEL;

test("quatre scénarios : qui vend et qui est au-dessus", () => {
  assert.deepEqual(commissionRatesFor("Leader", false, m), { scenario: "LEADER", seller: 20, level1: 6, level2: 2 });
  assert.deepEqual(commissionRatesFor("Parrain", false, m), { scenario: "PARRAIN", seller: 19, level1: 6, level2: 2 });
  assert.deepEqual(commissionRatesFor("Consultant", true, m), { scenario: "CONSULTANT", seller: 18, level1: 4, level2: 2 });
  assert.deepEqual(commissionRatesFor("Consultant", false, m), { scenario: "CONSULTANT_DIRECT", seller: 18, level1: 6, level2: 2 });
});

test("tout est paramétrable : chaque case du tableau peut être changée indépendamment", () => {
  const custom = normalizeBusinessModel({
    sellerLeaderPct: 25, sellerParrainPct: 20, sponsorAlonePct: 4, // le Parrain vend : 20 % pour lui, 4 % pour son Leader
    sellerPct: 15, sponsorSharedPct: 5, grandSponsorPct: 1,
    sellerConsultantDirectPct: 17, leaderDirectPct: 9,
  });
  assert.equal(commissionRatesFor("Leader", false, custom).seller, 25);
  const p = commissionRatesFor("Parrain", false, custom);
  assert.equal(p.seller, 20);
  assert.equal(p.level1, 4);
  const c = commissionRatesFor("Consultant", true, custom);
  assert.deepEqual([c.seller, c.level1, c.level2], [15, 5, 1]);
  const d = commissionRatesFor("Consultant", false, custom);
  assert.deepEqual([d.seller, d.level1], [17, 9]);
});

test("réglages enregistrés avant le scénario « Consultant sous un Leader » : comportement d'avant conservé", () => {
  const legacy = normalizeBusinessModel({ sellerLeaderPct: 20, sellerParrainPct: 19, sellerPct: 16, sponsorAlonePct: 7, sponsorSharedPct: 4, grandSponsorPct: 2 });
  assert.equal(legacy.sellerConsultantDirectPct, 16); // reprend la commission du Consultant
  assert.equal(legacy.leaderDirectPct, 7); // reprend la part « parrain seul »
  const saved = normalizeBusinessModel({ ...legacy, sellerConsultantDirectPct: 14, leaderDirectPct: 8 });
  assert.equal(saved.sellerConsultantDirectPct, 14);
  assert.equal(saved.leaderDirectPct, 8);
});

test("pourcentages hors limites ignorés", () => {
  const bad = normalizeBusinessModel({ leaderDirectPct: 150, sellerConsultantDirectPct: -2 });
  assert.equal(bad.leaderDirectPct, DEFAULT_BUSINESS_MODEL.sponsorAlonePct);
  assert.equal(bad.sellerConsultantDirectPct, DEFAULT_BUSINESS_MODEL.sellerPct);
});
