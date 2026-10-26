import { test } from "node:test";
import assert from "node:assert/strict";
import { gainLine, productsLabel, shortName, type SaleDetail } from "../sale-details";
import { creditNotice } from "../wallet-notify";

const d: SaleDetail = { orderId: "cmv884zkc000208l63k8riwnb", ref: "3K8RIWNB", products: "Aqua Soul for Him 50 ml ×2", buyer: "Awa Diop Ndiaye", sellerId: "c1", sellerName: "Moussa Sarr" };

test("produits et nom court", () => {
  assert.equal(shortName("Awa Diop Ndiaye"), "Awa N.");
  assert.equal(shortName("Awa"), "Awa");
  assert.equal(productsLabel([{ productName: "Aqua Soul", volumeLabel: "50 ml", quantity: 2 }, { productName: "Étui", volumeLabel: "Format unique", quantity: 1 }]), "Aqua Soul 50 ml ×2, Étui");
  assert.equal(productsLabel(Array.from({ length: 5 }, (_, i) => ({ productName: `P${i}`, volumeLabel: "", quantity: 1 }))), "P0, P1, P2 +2");
});

test("ligne de gain : sa vente (acheteur complet) ou celle de l'équipe (nom court + vendeur)", () => {
  assert.match(gainLine({ amount: 2600, level: "VENTE" }, d, "c1"), /^2\s600 F · Aqua Soul for Him 50 ml ×2, acheteur Awa Diop Ndiaye \(commande 3K8RIWNB\)$/);
  const team = gainLine({ amount: 500, level: "NIVEAU_1" }, d, "c9");
  assert.match(team, /acheteur Awa N\., vendu par Moussa Sarr/);
  assert.match(gainLine({ amount: 1000, level: "LIVRAISON" }, d, "l1"), /livraison chez Awa N\./);
  assert.match(gainLine({ amount: 5000, level: "PRIME_EQUIPE" }, undefined, "c1"), /prime d'équipe/);
});

test("notification de commission avec produit et acheteur", () => {
  const own = creditNotice({ ownerType: "CONSULTANT", ownerId: "c1", amount: 2870, level: "VENTE", orderId: d.orderId, rate: 10, base: 28700, sale: d });
  assert.match(own.message, /votre vente : Aqua Soul for Him 50 ml ×2, acheteur Awa Diop Ndiaye \(commande 3K8RIWNB\)/);
  const sponsor = creditNotice({ ownerType: "CONSULTANT", ownerId: "c9", amount: 300, level: "NIVEAU_1", orderId: d.orderId, sale: d });
  assert.match(sponsor.message, /acheteur Awa N\., vendu par Moussa Sarr/);
});
