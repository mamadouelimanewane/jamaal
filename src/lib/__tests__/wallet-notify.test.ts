import { test } from "node:test";
import assert from "node:assert/strict";
import { creditNotice } from "../wallet-notify";

test("notification de commission : montant, taux, rôle et commande", () => {
  const n = creditNotice({ ownerType: "CONSULTANT", ownerId: "c1", amount: 2870, level: "VENTE", orderId: "cmv884zkc000208l63k8riwnb", rate: 10, base: 28700 });
  assert.equal(n.title, "Commission créditée");
  assert.match(n.message, /2\s870 FCFA/);
  assert.match(n.message, /10 % de 28\s700 FCFA/);
  assert.match(n.message, /votre vente/);
  assert.match(n.message, /commande 3K8RIWNB/);
});

test("parrain niveau 1 et niveau 2 : le rôle est explicite", () => {
  assert.match(creditNotice({ ownerType: "CONSULTANT", ownerId: "c", amount: 100, level: "NIVEAU_1", orderId: "abcdefghijkl" }).message, /niveau 1/);
  assert.match(creditNotice({ ownerType: "CONSULTANT", ownerId: "c", amount: 100, level: "NIVEAU_2", orderId: "abcdefghijkl" }).message, /niveau 2/);
});

test("part de livraison et prime d'équipe", () => {
  const l = creditNotice({ ownerType: "LIVREUR", ownerId: "l1", amount: 1000, level: "LIVRAISON", orderId: "abcdefghijkl" });
  assert.equal(l.title, "Part de livraison créditée");
  assert.match(l.message, /votre livraison/);
  const p = creditNotice({ ownerType: "CONSULTANT", ownerId: "c", amount: 5000, level: "PRIME_EQUIPE", orderId: "PRIME-EQUIPE-2026-10" });
  assert.equal(p.title, "Prime d'équipe créditée");
  assert.doesNotMatch(p.message, /commande/);
});
