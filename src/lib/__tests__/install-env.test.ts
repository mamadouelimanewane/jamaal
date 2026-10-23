import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv, safeNext } from "../install-env";

test("navigateur pour l'installation", () => {
  assert.equal(installEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"), "ios-safari");
  assert.equal(installEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1"), "ios-other");
  assert.equal(installEnv("Mozilla/5.0 (Linux; Android 14; SM-A146P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"), "android");
  assert.equal(installEnv("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 WhatsApp/2.24"), "in-app");
  assert.equal(installEnv("Mozilla/5.0 (Linux; Android 13; SM-A146P Build/TP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/124.0 Mobile Safari/537.36"), "in-app");
  assert.equal(installEnv("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0"), "in-app");
  assert.equal(installEnv("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15", 5, "MacIntel"), "ios-safari");
  assert.equal(installEnv("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36"), "desktop");
});

test("suite après installation : pages de l'espace seulement", () => {
  assert.equal(safeNext("/admin/reset-password?token=abc"), "/admin/reset-password?token=abc");
  assert.equal(safeNext("https://evil.example"), "/admin/login");
  assert.equal(safeNext("//evil.example/admin"), "/admin/login");
  assert.equal(safeNext(undefined), "/admin/login");
});

import { findProducts } from "../product-finder";
test("recherche revendeur : code sans zéro, mots collés, fautes de frappe", () => {
  const ps = [
    { name: "Aqua Soul for Him", choganCode: "021M", inspiredBy: "Light Blue", inspiredBrand: "Dolce & Gabbana" },
    { name: "Rebel Icon", choganCode: "T127", inspiredBy: "Fucking Fabulous", inspiredBrand: "Tom Ford" },
  ];
  assert.equal(findProducts(ps, "21m")[0].name, "Aqua Soul for Him");
  assert.equal(findProducts(ps, "21 M")[0].name, "Aqua Soul for Him");
  assert.equal(findProducts(ps, "aquasoul")[0].name, "Aqua Soul for Him");
  assert.equal(findProducts(ps, "Ligth blue")[0].name, "Aqua Soul for Him");
  assert.equal(findProducts(ps, "tom ford")[0].name, "Rebel Icon");
  assert.equal(findProducts(ps, "t127")[0].name, "Rebel Icon");
  assert.equal(findProducts(ps, "zzzz").length, 0);
});
