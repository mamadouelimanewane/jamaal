import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUSINESS_MODEL, normalizeBusinessModel, normalizeGrid } from "../business-model";
import { quoteForDistance } from "../delivery";

const grid = { ...DEFAULT_BUSINESS_MODEL, deliveryPricing: "GRILLE" as const, deliveryMaxKm: 0, livreurSharePct: 70 };

test("grille : prix et commission de la tranche, bornes incluses", () => {
  const a = quoteForDistance(3, 0, grid);
  assert.ok(a.ok && a.fee === 1000 && a.livreurShare === 700 && a.bracket === 0);
  const b = quoteForDistance(3.1, 0, grid);
  assert.ok(b.ok && b.fee === 1500 && b.livreurShare === 1000 && b.bracket === 1);
  const c = quoteForDistance(39.9, 0, grid);
  assert.ok(c.ok && c.fee === 5000);
  const out = quoteForDistance(41, 0, grid);
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.error, /maximum 40 km/);
});

test("grille : commission à 0 = part en %, minimum livreur, livraison offerte payée au livreur", () => {
  const m = { ...grid, deliveryGrid: [{ upToKm: 5, fee: 1500, livreur: 0 }], livreurMinPay: 0 };
  const q = quoteForDistance(2, 0, m);
  assert.ok(q.ok && q.livreurShare === 1050);
  const min = quoteForDistance(2, 0, { ...m, livreurMinPay: 1200 });
  assert.ok(min.ok && min.livreurShare === 1200);
  const free = quoteForDistance(2, 50_000, { ...m, deliveryFreeAbove: 30_000 });
  assert.ok(free.ok && free.fee === 0 && free.free && free.livreurShare === 1050);
});

test("calcul au km inchangé", () => {
  const q = quoteForDistance(8, 0, DEFAULT_BUSINESS_MODEL);
  // 1000 + (8 - 3) × 200 = 2000, livreur 70 %
  assert.ok(q.ok && q.fee === 2000 && q.livreurShare === 1400 && q.bracket === undefined);
  assert.equal(quoteForDistance(45, 0, DEFAULT_BUSINESS_MODEL).ok, false);
});

test("grille enregistrée : nettoyée, triée, sans doublons", () => {
  assert.deepEqual(normalizeGrid([{ upToKm: 10, fee: 2000, livreur: 1400 }, { upToKm: "3", fee: "1000", livreur: -5 }, { upToKm: 10, fee: 9 }, { upToKm: 0, fee: 1 }]), [
    { upToKm: 3, fee: 1000, livreur: 0 },
    { upToKm: 10, fee: 2000, livreur: 1400 },
  ]);
  const m = normalizeBusinessModel({ deliveryPricing: "GRILLE", deliveryGrid: [{ upToKm: 4, fee: 1200, livreur: 800 }], livreurMinPay: 500 });
  assert.equal(m.deliveryPricing, "GRILLE");
  assert.equal(m.deliveryGrid.length, 1);
  assert.equal(m.livreurMinPay, 500);
  assert.equal(normalizeBusinessModel({ deliveryGrid: [] }).deliveryGrid.length, 6);
});
