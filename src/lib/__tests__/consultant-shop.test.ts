import { test } from "node:test";
import assert from "node:assert/strict";
import { orderFavorites, shopWhatsAppLink } from "../shop/consultant-shop";

test("coups de cœur : ordre du consultant, doublons et produits disparus ignorés, 8 au plus", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(orderFavorites(["c", "x", "a", "c"], rows).map((r) => r.id), ["c", "a"]);
  assert.equal(orderFavorites(Array.from({ length: 12 }, (_, i) => `p${i}`), Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }))).length, 8);
});

test("lien WhatsApp de la boutique", () => {
  assert.equal(shopWhatsAppLink("77 123 45 67", "Bonjour"), "https://wa.me/221771234567?text=Bonjour");
  assert.equal(shopWhatsAppLink("+221 77 123 45 67", "a b"), "https://wa.me/221771234567?text=a%20b");
  assert.equal(shopWhatsAppLink("123", "x"), null);
});
