import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLivreur, type DispatchCandidate } from "../delivery-dispatch";
import { matchesSearch } from "../../components/ListSearch";

const depot = { lat: 14.6928, lng: -17.4467 };
const c = (id: string, km: number, load: number, live = true): DispatchCandidate => ({ id, name: id, pos: { lat: depot.lat + km / 111, lng: depot.lng }, live, load });

test("attribution automatique : en ligne, proche du dépôt, peu chargé, sous le maximum", () => {
  assert.equal(pickLivreur([c("loin", 8, 0), c("pres", 1, 0)], depot, 4)?.id, "pres");
  assert.equal(pickLivreur([c("pres-charge", 1, 3), c("moyen", 3, 0)], depot, 4)?.id, "moyen");
  assert.equal(pickLivreur([c("plein", 1, 4), c("libre", 9, 1)], depot, 4)?.id, "libre");
  assert.equal(pickLivreur([c("horsligne", 0.5, 0, false), c("enligne", 6, 2)], depot, 4)?.id, "enligne");
  assert.equal(pickLivreur([c("a", 1, 2, false), c("b", 5, 0, false)], depot, 4)?.id, "b");
  assert.equal(pickLivreur([c("plein", 1, 4)], depot, 4), null);
});

test("recherche de consultants : accents, ordre des mots, numéros", () => {
  const row = "Aïssatou Diop Thiès +221 77 123 45 67 Fatou Ndiaye actif";
  assert.equal(matchesSearch(row, "aissatou"), true);
  assert.equal(matchesSearch(row, "thies diop"), true);
  assert.equal(matchesSearch(row, "771234567"), true);
  assert.equal(matchesSearch(row, "77 123"), true);
  assert.equal(matchesSearch(row, "dakar"), false);
});
