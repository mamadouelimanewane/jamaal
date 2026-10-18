import { test } from "node:test";
import assert from "node:assert/strict";
import { allows, moduleForPath, MODULES, normalizePermissions, PROFILE_TEMPLATES, summarizePermissions } from "../permissions";

test("chaque page d'administration réservée à l'équipe appartient à un module", () => {
  assert.equal(moduleForPath("/admin/produits"), "catalogue");
  assert.equal(moduleForPath("/admin/produits/listino"), "catalogue");
  assert.equal(moduleForPath("/admin/commandes/abc/facture"), "commandes");
  assert.equal(moduleForPath("/admin/reservations/a-commander"), "commandes");
  assert.equal(moduleForPath("/admin/comptabilite/bilan"), "comptabilite");
  assert.equal(moduleForPath("/admin/modele-economique"), "reglages");
  assert.equal(moduleForPath("/admin/utilisateurs/profils"), "utilisateurs");
  assert.equal(moduleForPath("/admin/historique"), "utilisateurs");
  // Pages ouvertes à tous les rôles ou sans module : aucun module.
  assert.equal(moduleForPath("/admin/mes-ventes"), null);
  assert.equal(moduleForPath("/admin"), null);
  // Un préfixe ne déborde pas sur un nom voisin.
  assert.equal(moduleForPath("/admin/produitsXYZ"), null);
});

test("administrateur complet (aucun profil) : tout est permis ; profil restreint : refus par défaut", () => {
  assert.equal(allows(null, null, "write"), true);
  assert.equal(allows(null, "comptabilite", "write"), true);
  assert.equal(allows({}, "catalogue", "read"), false);
  assert.equal(allows({ catalogue: "read" }, "catalogue", "read"), true);
  assert.equal(allows({ catalogue: "read" }, "catalogue", "write"), false);
  assert.equal(allows({ catalogue: "write" }, "catalogue", "read"), true); // écrire donne aussi lire
  assert.equal(allows({ catalogue: "write" }, "stocks", "read"), false);
  assert.equal(allows({ catalogue: "write" }, null, "read"), false); // action sans module : réservée à l'administrateur complet
  assert.equal(allows({ catalogue: "write" }, undefined, "write"), false);
});

test("normalisation : seuls les modules connus et les niveaux valides sont gardés", () => {
  assert.deepEqual(normalizePermissions({ catalogue: "write", stocks: "read", pirate: "write", clients: "admin", commandes: 1 }), { catalogue: "write", stocks: "read" });
  assert.deepEqual(normalizePermissions(null), {});
  assert.deepEqual(normalizePermissions("x"), {});
});

test("résumé lisible des privilèges", () => {
  assert.equal(summarizePermissions({}), "Aucun accès");
  assert.equal(summarizePermissions({ catalogue: "write", stocks: "write", commandes: "read" }), "Écriture : Catalogue, Stocks · Lecture : Commandes et réservations");
});

test("profils proposés : valides, sans accès aux utilisateurs, sans doublon de nom", () => {
  const names = PROFILE_TEMPLATES.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of PROFILE_TEMPLATES) {
    assert.deepEqual(normalizePermissions(t.permissions), t.permissions, t.name);
    assert.equal(t.permissions.utilisateurs, undefined, t.name);
  }
  assert.equal(MODULES.length, 12);
});
