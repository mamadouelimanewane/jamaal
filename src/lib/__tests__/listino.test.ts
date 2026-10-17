import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedFormats, formatKey, LISTINO, mergeVolumes, normalizeCode, planListino, sellPrice, type PlanProduct } from "../listino";

test("prix de vente = prix Chogan en euros × 655,957 × 1,25, arrondi à la centaine", () => {
  assert.equal(sellPrice(35), 28700);
  assert.equal(sellPrice(18), 14800);
  assert.equal(sellPrice(11.9), 9800);
  assert.equal(sellPrice(48), 39400);
  assert.equal(sellPrice(52), 42600);
  assert.equal(sellPrice(60), 49200);
});

test("codes Chogan comparables : zéros, lettre finale et espaces ignorés, codes-noms conservés", () => {
  assert.equal(normalizeCode("001M"), "1");
  assert.equal(normalizeCode("074M"), "74");
  assert.equal(normalizeCode("74M"), "74");
  assert.equal(normalizeCode("075"), "75");
  assert.equal(normalizeCode("044U"), "44");
  assert.equal(normalizeCode("NADIR"), "NADIR");
  assert.equal(normalizeCode("EVENT23W"), "EVENT23W");
  assert.equal(formatKey("15 ml · recharge"), "15ml");
  assert.equal(formatKey("70 ml"), "70ml");
});

test("le listing est cohérent : 15 ml < 30 ml < 70 ml, codes présents, pas de doublon", () => {
  assert.ok(LISTINO.parfums.length > 100);
  for (const p of LISTINO.parfums) {
    assert.ok(p.eur[15] < p.eur[30] && p.eur[30] < p.eur[70], p.code);
    assert.ok(p.code && p.code30 && p.code15, p.code);
  }
  for (const l of LISTINO.luxury) assert.ok(l.eur[15] < l.eur[50] && l.code15, l.code);
  const codes = [...LISTINO.parfums.map((p) => normalizeCode(p.code)), ...LISTINO.luxury.map((l) => normalizeCode(l.code))];
  assert.equal(new Set(codes).size, codes.length);
});

const prod = (o: Partial<PlanProduct> & { choganCode: string }): PlanProduct => ({ id: "p-" + o.choganCode, name: "Produit " + o.choganCode, category: "parfum-homme", volumes: [{ label: "70 ml", price: 28700 }], variantCount: 0, ...o });

test("plan : formats manquants ajoutés, produit complet reconnu, écart de prix signalé, référence introuvable listée", () => {
  const first = LISTINO.parfums[0]; // 001M
  const full = expectedFormats(first).map((f) => ({ label: f.label, price: f.price }));
  const plan = planListino(
    [
      prod({ choganCode: first.code, volumes: full, variantCount: 3 }),
      prod({ choganCode: LISTINO.parfums[1].code }),
      prod({ choganCode: LISTINO.parfums[2].code, volumes: [{ label: "70 ml", price: 20000 }], variantCount: 2 }),
      prod({ choganCode: LISTINO.parfums[3].code, volumes: null }),
    ],
    LISTINO
  );
  assert.equal(plan.complete, 1);
  assert.equal(plan.items.length, 2);
  const second = plan.items.find((i) => i.code === LISTINO.parfums[1].code)!;
  assert.deepEqual(second.add.map((f) => f.label), ["30 ml", "15 ml · recharge"]);
  assert.equal(second.ensureMain, true); // pas de lignes de stock par format : celle du 70 ml doit être créée
  assert.equal(second.mainLabel, "70 ml");
  assert.equal(plan.items.find((i) => i.code === LISTINO.parfums[2].code)!.ensureMain, false);
  assert.equal(plan.priceDiffs.length, 1);
  assert.equal(plan.priceDiffs[0].site, 20000);
  assert.equal(plan.singleFormat.length, 1);
  assert.equal(plan.formatsToAdd, 4);
  assert.ok(plan.notFound.length > 100); // tout le reste du listing n'a pas de produit dans ce jeu d'essai
});

test("un produit hors parfums n'est jamais associé (codes numériques identiques)", () => {
  const plan = planListino([prod({ choganCode: LISTINO.parfums[0].code, category: "soins-corps" })], LISTINO);
  assert.equal(plan.items.length, 0);
  assert.ok(plan.notFound.includes(LISTINO.parfums[0].code));
});

test("fusion des volumes : ordre du plus grand au plus petit, sans doublon, code du format principal posé", () => {
  const add = expectedFormats(LISTINO.parfums[0]).slice(1);
  const merged = mergeVolumes([{ label: "70 ml", price: 28700 }], add, LISTINO.parfums[0].code);
  assert.deepEqual(merged.map((v) => v.label), ["70 ml", "30 ml", "15 ml · recharge"]);
  assert.equal(merged[0].code, LISTINO.parfums[0].code);
  assert.equal(mergeVolumes(merged, add).length, 3);
});
