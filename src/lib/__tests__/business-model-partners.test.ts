import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUSINESS_MODEL, normalizeBusinessModel, productMargin } from "../business-model";

test("par défaut : frais divers à 15 %, partenaires étranger et local à 0 (à définir)", () => {
  assert.equal(DEFAULT_BUSINESS_MODEL.miscPct, 15);
  assert.equal(DEFAULT_BUSINESS_MODEL.foreignPartnerPct, 0);
  assert.equal(DEFAULT_BUSINESS_MODEL.localPartnerPct, 0);
});

test("un modèle enregistré avant l'ajout des partenaires garde ses frais divers et reçoit 0 pour les partenaires", () => {
  const m = normalizeBusinessModel({ miscPct: 12, sellerPct: 20 });
  assert.equal(m.miscPct, 12);
  assert.equal(m.foreignPartnerPct, 0);
  assert.equal(m.localPartnerPct, 0);
  assert.equal(m.sellerPct, 20);
});

test("pourcentages des partenaires : valeurs valides conservées, valeurs hors limites ignorées", () => {
  const ok = normalizeBusinessModel({ foreignPartnerPct: 4.5, localPartnerPct: 2 });
  assert.equal(ok.foreignPartnerPct, 4.5);
  assert.equal(ok.localPartnerPct, 2);
  const bad = normalizeBusinessModel({ foreignPartnerPct: 250, localPartnerPct: -3 });
  assert.equal(bad.foreignPartnerPct, 0);
  assert.equal(bad.localPartnerPct, 0);
});

test("marge : avec partenaires à 0, la marge nette est celle d'avant (frais divers inclus)", () => {
  const m = DEFAULT_BUSINESS_MODEL;
  const r = productMargin(10_000, m);
  const sale = (10_000 * m.salePct) / 100;
  const purchase = (10_000 * m.purchasePct) / 100;
  const sponsors = (sale * (m.sponsorSharedPct + m.grandSponsorPct)) / 100;
  const expected = sale - purchase - (sale * m.sellerPct) / 100 - sponsors - (10_000 * (m.shippingPct + m.miscPct)) / 100;
  assert.ok(Math.abs(r.net - expected) < 1e-6);
  const foreign = r.lines.find((l) => l.label === "Partenaire étranger (Europe)")!;
  const local = r.lines.find((l) => l.label === "Partenaire local")!;
  assert.equal(Math.abs(foreign.amount), 0);
  assert.equal(Math.abs(local.amount), 0);
});

test("marge : chaque partenaire retire son pourcentage du prix public de la marge de JAMAAL", () => {
  const base = productMargin(10_000, DEFAULT_BUSINESS_MODEL);
  const withPartners = productMargin(10_000, { ...DEFAULT_BUSINESS_MODEL, foreignPartnerPct: 3, localPartnerPct: 2 });
  assert.ok(Math.abs(base.net - withPartners.net - 500) < 1e-6); // 5 % de 10 000
  assert.equal(Math.round(Math.abs(withPartners.lines.find((l) => l.label === "Partenaire étranger (Europe)")!.amount)), 300);
  assert.equal(Math.round(Math.abs(withPartners.lines.find((l) => l.label === "Partenaire local")!.amount)), 200);
});
