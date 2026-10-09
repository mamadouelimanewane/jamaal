import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveTitle, recruitTitleFor, teamLimitFor, titleFromLoaded } from "../network";
import { DEFAULT_BUSINESS_MODEL, normalizeBusinessModel, primeStatus } from "../business-model";

test("rang attribué prioritaire sur la place dans la chaîne", () => {
  assert.equal(effectiveTitle(null, 0), "Leader");
  assert.equal(effectiveTitle(null, 1), "Parrain");
  assert.equal(effectiveTitle(null, 2), "Consultant");
  assert.equal(effectiveTitle("LEADER", 2), "Leader");
  assert.equal(effectiveTitle("CONSULTANT", 1), "Consultant");
  assert.equal(effectiveTitle("inconnu", 1), "Parrain");
  assert.equal(titleFromLoaded({ rank: null, sponsorId: "a", sponsor: { sponsorId: "b" } }), "Consultant");
  assert.equal(titleFromLoaded({ rank: "PARRAIN", sponsorId: null }), "Parrain");
});

test("recrues et limites par rang : 10 Parrains par Leader, 20 Consultants par Parrain", () => {
  assert.equal(recruitTitleFor("Leader"), "Parrain");
  assert.equal(recruitTitleFor("Parrain"), "Consultant");
  assert.equal(recruitTitleFor("Consultant"), null);
  assert.equal(teamLimitFor("Leader", DEFAULT_BUSINESS_MODEL), 10);
  assert.equal(teamLimitFor("Parrain", DEFAULT_BUSINESS_MODEL), 20);
  assert.equal(teamLimitFor("Consultant", DEFAULT_BUSINESS_MODEL), -1);
});

test("modèle économique : limites et primes d'équipe (désactivées par défaut)", () => {
  const m = normalizeBusinessModel({ maxParrainsPerLeader: 12, leaderTeamTiers: [{ threshold: 2_000_000, amount: 30_000 }, { threshold: 0, amount: 5 }] });
  assert.equal(m.maxParrainsPerLeader, 12);
  assert.equal(m.maxConsultantsPerParrain, 20);
  assert.equal(m.teamPrimesEnabled, false);
  assert.deepEqual(m.leaderTeamTiers, [{ threshold: 2_000_000, amount: 30_000, extra: undefined }]);
  assert.equal(normalizeBusinessModel(null).parrainTeamTiers.length, 3);
  const st = primeStatus(1_200_000, m, DEFAULT_BUSINESS_MODEL.leaderTeamTiers);
  assert.equal(st.reached?.amount, 15_000);
  assert.equal(st.next?.threshold, 2_500_000);
});
