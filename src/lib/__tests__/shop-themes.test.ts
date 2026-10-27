import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOP_THEMES,
  DEFAULT_THEME_ID,
  getShopTheme,
  type ShopThemeId,
} from "../shop/themes";

test("thèmes de boutique : au moins 6 thèmes définis avec identifiants uniques", () => {
  assert.ok(SHOP_THEMES.length >= 6);
  const ids = SHOP_THEMES.map((t) => t.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size);
});

test("thèmes : chaque thème possède une palette et les styles essentiels", () => {
  for (const t of SHOP_THEMES) {
    assert.ok(t.name.length > 0, `Nom manquant pour ${t.id}`);
    assert.ok(t.palette.background, `Fond manquant pour ${t.id}`);
    assert.ok(t.palette.accent, `Accent manquant pour ${t.id}`);
    assert.ok(t.palette.primary, `Primaire manquant pour ${t.id}`);

    assert.ok(t.styles.pageBg.length > 0, `pageBg manquant pour ${t.id}`);
    assert.ok(t.styles.textPrimary.length > 0, `textPrimary manquant pour ${t.id}`);
    assert.ok(t.styles.buttonPrimary.length > 0, `buttonPrimary manquant pour ${t.id}`);
    assert.ok(t.styles.cardBg.length > 0, `cardBg manquant pour ${t.id}`);
    assert.ok(t.styles.waButton.length > 0, `waButton manquant pour ${t.id}`);
  }
});

test("getShopTheme : retourne le thème demandé ou le thème signature par défaut", () => {
  const def = getShopTheme(null);
  assert.equal(def.id, DEFAULT_THEME_ID);

  const defUndef = getShopTheme(undefined);
  assert.equal(defUndef.id, DEFAULT_THEME_ID);

  const defInvalid = getShopTheme("theme-inconnu");
  assert.equal(defInvalid.id, DEFAULT_THEME_ID);

  const gold = getShopTheme("noir-gold");
  assert.equal(gold.id, "noir-gold");
  assert.equal(gold.isDark, true);

  const emerald = getShopTheme("royal-emerald");
  assert.equal(emerald.id, "royal-emerald");

  const minimal = getShopTheme("pearl-minimal");
  assert.equal(minimal.id, "pearl-minimal");
});
