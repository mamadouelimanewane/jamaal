import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedChoganUrl, relayToken } from "../chogan/relay";

test("relais Chogan : seules les pages produit, la recherche et les images Chogan passent", () => {
  assert.ok(allowedChoganUrl("https://www.chogangroupspa.com/chogangroup/productDetail/9479"));
  assert.ok(allowedChoganUrl("https://www.chogangroupspa.com/chogangroup/productList?search=MM061"));
  assert.ok(allowedChoganUrl("https://cdn.chogangroupspa.com/images/prodotti/big/PR1.jpg"));
  for (const bad of [
    null,
    "pas une adresse",
    "http://www.chogangroupspa.com/chogangroup/productDetail/9479",
    "https://www.chogangroupspa.com/chogangroup/login",
    "https://www.chogangroupspa.com/chogangroup/productDetail/9479/../../admin",
    "https://evil.example/chogangroup/productDetail/1",
    "https://www.chogangroupspa.com.evil.example/chogangroup/productList",
    "https://user:pw@www.chogangroupspa.com/chogangroup/productList",
    "https://cdn.chogangroupspa.com/autre/x.jpg",
  ]) assert.equal(allowedChoganUrl(bad), null, String(bad));
});

test("jeton du relais : stable pour un secret, différent d'un secret à l'autre", async () => {
  const a = await relayToken("secret-1");
  assert.equal(a, await relayToken("secret-1"));
  assert.notEqual(a, await relayToken("secret-2"));
  assert.match(a, /^[0-9a-f]{64}$/);
});
