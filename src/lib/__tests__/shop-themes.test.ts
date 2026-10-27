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

test("thèmes : chaque thème possède une palette complète (primary, accent, background, surface, glow)", () => {
  for (const t of SHOP_THEMES) {
    assert.ok(t.name.length > 0, `Nom manquant pour ${t.id}`);
    assert.ok(t.emoji && t.emoji.length > 0, `Emoji manquant pour ${t.id}`);
    assert.ok(t.description && t.description.length > 0, `Description manquante pour ${t.id}`);
    assert.ok(t.palette.background, `Fond manquant pour ${t.id}`);
    assert.ok(t.palette.accent, `Accent manquant pour ${t.id}`);
    assert.ok(t.palette.primary, `Primaire manquant pour ${t.id}`);
    assert.ok(t.palette.surface, `Surface manquante pour ${t.id}`);
    assert.ok(t.palette.glow, `Glow manquant pour ${t.id}`);
  }
});

test("thèmes : chaque thème possède tous les styles essentiels", () => {
  const requiredStyles: (keyof typeof SHOP_THEMES[0]["styles"])[] = [
    "pageBg",
    "heroOverlay",
    "textPrimary",
    "textSecondary",
    "textMuted",
    "textAccent",
    "cardBg",
    "cardBorder",
    "cardHover",
    "avatarBorder",
    "avatarRing",
    "badgeStyle",
    "buttonPrimary",
    "buttonSecondary",
    "waButton",
    "shortcutHover",
    "productCardBg",
    "productCardHover",
    "guaranteeBannerBg",
    "guaranteeBannerText",
    "starColor",
    "dividerStyle",
    "priceStyle",
  ];

  for (const t of SHOP_THEMES) {
    for (const key of requiredStyles) {
      const val = t.styles[key];
      assert.ok(val !== undefined && String(val).length > 0, `${key} manquant pour ${t.id}`);
    }
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
  assert.equal(gold.emoji, "✨");

  const emerald = getShopTheme("royal-emerald");
  assert.equal(emerald.id, "royal-emerald");
  assert.equal(emerald.isDark, true);

  const minimal = getShopTheme("pearl-minimal");
  assert.equal(minimal.id, "pearl-minimal");
  assert.equal(minimal.isDark, false);
});

test("thèmes sombres et clairs : isDark cohérent avec la palette", () => {
  const darkThemes = SHOP_THEMES.filter((t) => t.isDark);
  const lightThemes = SHOP_THEMES.filter((t) => !t.isDark);

  assert.ok(darkThemes.length >= 3, "Au moins 3 thèmes sombres attendus");
  assert.ok(lightThemes.length >= 3, "Au moins 3 thèmes clairs attendus");

  // Les thèmes sombres ont logoInvert = true
  for (const t of darkThemes) {
    assert.equal(t.styles.logoInvert, true, `${t.id} devrait avoir logoInvert:true`);
  }
});
