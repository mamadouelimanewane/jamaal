import { test } from "node:test";
import assert from "node:assert/strict";
import { giftRedemption, looksLikeGiftCode, newGiftCode, occasionPhrase, validGiftAmount, cleanPhone } from "../gift/gift";
import { addDays, intervalLabel, isDue, itemsLabel, needsReminder, parseSubDelivery, parseSubItems, subscriptionDiscount, validInterval } from "../subscriptions/plan";

test("carte cadeau : montant, code, occasion", () => {
  assert.equal(validGiftAmount("25 000"), 25_000);
  assert.equal(validGiftAmount(1000), null);
  assert.equal(validGiftAmount(900_000), null);
  assert.equal(validGiftAmount(12_345), 12_500);
  const code = newGiftCode();
  assert.ok(looksLikeGiftCode(code), code);
  assert.ok(!/[01OI]/.test(code.slice(4)));
  assert.equal(occasionPhrase("tabaski"), " pour la Tabaski");
  assert.equal(occasionPhrase("autre"), "");
  assert.equal(occasionPhrase("x"), "");
  assert.equal(giftRedemption(20_000, 35_000), 20_000);
  assert.equal(giftRedemption(50_000, 35_000), 35_000);
  assert.equal(cleanPhone("+33 6 12 34 56 78"), "33612345678");
  assert.equal(cleanPhone("abc"), null);
});

test("abonnement : remise, échéances et rappel", () => {
  assert.equal(subscriptionDiscount(40_000, 5), 2_000);
  assert.equal(subscriptionDiscount(40_000, 80), 12_000, "plafond 30 %");
  assert.equal(validInterval("60"), 60);
  assert.equal(validInterval(12), 45);
  const now = new Date("2026-10-23T08:00:00Z");
  const sub = { status: "ACTIVE", nextRunAt: addDays(now, 2), remindedAt: null };
  assert.equal(needsReminder(sub, now), true);
  assert.equal(needsReminder({ ...sub, remindedAt: now }, now), false, "déjà rappelé");
  assert.equal(needsReminder({ ...sub, nextRunAt: addDays(now, 10) }, now), false);
  assert.equal(needsReminder({ ...sub, remindedAt: addDays(now, -50) }, now), true, "rappel de l'échéance précédente");
  assert.equal(isDue({ ...sub, nextRunAt: addDays(now, -1) }, now), true);
  assert.equal(isDue({ ...sub, status: "PAUSE", nextRunAt: addDays(now, -1) }, now), false);
  assert.equal(intervalLabel(60), "tous les 2 mois");
  assert.equal(intervalLabel(45), "tous les 45 jours");
  const items = parseSubItems([{ productId: "p1", productName: "Aqua Soul", volumeLabel: "70 ml", quantity: 2 }, { nope: 1 }]);
  assert.equal(items.length, 1);
  assert.equal(itemsLabel(items), "Aqua Soul (70 ml) ×2");
  assert.deepEqual(parseSubDelivery({ mode: "LIVRAISON", lat: "x" }), { mode: "RETRAIT" });
});

import { repriceItems } from "../subscriptions/plan";
test("abonnement : articles au prix du jour", () => {
  const items = [
    { productId: "a", productName: "Aqua", volumeLabel: "70 ml", quantity: 1 },
    { productId: "b", productName: "Savon", volumeLabel: "Unique", quantity: 2 },
    { productId: "c", productName: "Retiré", volumeLabel: "30 ml", quantity: 1 },
  ];
  const { priced, missing } = repriceItems(items, [
    { id: "a", name: "Aqua Soul", volumes: [{ label: "30 ml", price: 9000 }, { label: "70 ml", price: 17000 }], regularPrice: 17000 },
    { id: "b", name: "Savon", volumes: null, regularPrice: 4000 },
  ]);
  assert.deepEqual(priced.map((p) => [p.productName, p.price]), [["Aqua Soul", 17000], ["Savon", 4000]]);
  assert.deepEqual(missing, ["Retiré"]);
});
