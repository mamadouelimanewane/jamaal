import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUserChange, isFullAdmin, passwordProblem, type TargetUser } from "../user-rules";

const u = (o: Partial<TargetUser> = {}): TargetUser => ({ id: "t", role: "ADMIN", active: true, profileId: null, consultantId: null, livreurId: null, customerId: null, ...o });

test("on ne peut ni supprimer, ni suspendre, ni modifier son propre compte", () => {
  assert.match(checkUserChange("t", u(), { kind: "delete" }, 3)!, /propre compte/);
  assert.match(checkUserChange("t", u(), { kind: "suspend" }, 3)!, /propre compte/);
  assert.match(checkUserChange("t", u(), { kind: "setRole", role: "ADMIN", profileId: "p" }, 3)!, /propre rôle/);
});

test("le dernier administrateur complet est protégé (suppression, suspension, rétrogradation, restriction)", () => {
  assert.match(checkUserChange("a", u(), { kind: "delete" }, 0)!, /au moins un administrateur complet/);
  assert.match(checkUserChange("a", u(), { kind: "suspend" }, 0)!, /au moins un administrateur complet/);
  assert.match(checkUserChange("a", u(), { kind: "setRole", role: "CLIENT", profileId: null }, 0)!, /au moins un administrateur complet|fiche client/);
  assert.match(checkUserChange("a", u(), { kind: "setRole", role: "ADMIN", profileId: "p" }, 0)!, /au moins un administrateur complet/);
  // Avec un autre administrateur complet, c'est permis.
  assert.equal(checkUserChange("a", u(), { kind: "suspend" }, 1), null);
  assert.equal(checkUserChange("a", u(), { kind: "setRole", role: "ADMIN", profileId: "p" }, 1), null);
});

test("un administrateur déjà restreint ou suspendu n'est pas un administrateur complet", () => {
  assert.equal(isFullAdmin(u()), true);
  assert.equal(isFullAdmin(u({ profileId: "p" })), false);
  assert.equal(isFullAdmin(u({ active: false })), false);
  assert.equal(isFullAdmin(u({ role: "CONSULTANT" })), false);
  assert.equal(checkUserChange("a", u({ profileId: "p" }), { kind: "delete" }, 0), null);
});

test("changement de rôle : la fiche correspondante est exigée, un profil ne s'applique qu'aux administrateurs", () => {
  assert.match(checkUserChange("a", u({ role: "LIVREUR" }), { kind: "setRole", role: "CONSULTANT", profileId: null }, 1)!, /fiche revendeur/);
  assert.equal(checkUserChange("a", u({ role: "LIVREUR", consultantId: "c" }), { kind: "setRole", role: "CONSULTANT", profileId: null }, 1), null);
  assert.match(checkUserChange("a", u({ role: "CONSULTANT" }), { kind: "setRole", role: "LIVREUR", profileId: null }, 1)!, /fiche livreur/);
  assert.match(checkUserChange("a", u({ role: "CONSULTANT" }), { kind: "setRole", role: "CLIENT", profileId: null }, 1)!, /fiche client/);
  assert.match(checkUserChange("a", u({ role: "CONSULTANT", consultantId: "c" }), { kind: "setRole", role: "CONSULTANT", profileId: "p" }, 1)!, /ne s'applique qu'aux administrateurs/);
  assert.equal(checkUserChange("a", u({ role: "CONSULTANT" }), { kind: "setRole", role: "ADMIN", profileId: "p" }, 1), null);
});

test("règle du mot de passe", () => {
  assert.match(passwordProblem("abc12")!, /8 caractères/);
  assert.match(passwordProblem("abcdefgh")!, /une lettre et un chiffre/);
  assert.match(passwordProblem("12345678")!, /une lettre et un chiffre/);
  assert.equal(passwordProblem("Jamaal2026"), null);
});
