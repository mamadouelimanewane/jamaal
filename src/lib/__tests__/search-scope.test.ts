import { test } from "node:test";
import assert from "node:assert/strict";
import { searchScope } from "../search-scope";

test("recherche : un revendeur ne voit que ses commandes et ses clients, jamais les autres revendeurs", () => {
  const s = searchScope({ role: "CONSULTANT", perms: null, consultantId: "c1", livreurId: null });
  assert.deepEqual(s.orders, { consultantId: "c1" });
  assert.equal(s.customers, "own");
  assert.equal(s.consultants, false);
  assert.equal(s.products, true);
});

test("recherche : un revendeur sans fiche rattachée ne voit aucune commande", () => {
  const s = searchScope({ role: "CONSULTANT", perms: null, consultantId: null, livreurId: null });
  assert.equal(s.orders, null);
  assert.equal(s.customers, "none");
});

test("recherche : un livreur ne voit que ses livraisons, aucun client", () => {
  const s = searchScope({ role: "LIVREUR", perms: null, consultantId: null, livreurId: "l1" });
  assert.deepEqual(s.orders, { livreurId: "l1" });
  assert.equal(s.customers, "none");
  assert.equal(s.consultants, false);
});

test("recherche : l'administrateur complet voit tout", () => {
  const s = searchScope({ role: "ADMIN", perms: null, consultantId: null, livreurId: null });
  assert.deepEqual(s.orders, {});
  assert.equal(s.customers, "all");
  assert.equal(s.products, true);
  assert.equal(s.consultants, true);
});

test("recherche : l'administrateur restreint ne voit que les modules de son profil", () => {
  const s = searchScope({ role: "ADMIN", perms: { stocks: "write", catalogue: "read" }, consultantId: null, livreurId: null });
  assert.equal(s.orders, null);
  assert.equal(s.customers, "none");
  assert.equal(s.products, true);
  assert.equal(s.consultants, false);
});

test("recherche : un compte client n'a rien", () => {
  const s = searchScope({ role: "CUSTOMER", perms: null, consultantId: null, livreurId: null });
  assert.equal(s.orders, null);
  assert.equal(s.products, false);
});
