import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOP_THEMES,
  SHOP_THEME_IDS,
  DEFAULT_THEME_ID,
  getShopTheme,
  normalizeThemeId,
  shopLook,
  normalizeHidden,
  contrast,
} from "../shop/themes";

test("thèmes : les 14 thèmes, identifiants uniques et dans l'ordre", () => {
  assert.equal(SHOP_THEMES.length, 14);
  assert.deepEqual(SHOP_THEMES.map((t) => t.id), [...SHOP_THEME_IDS]);
});

test("thèmes : anciens identifiants convertis, inconnus vers le thème par défaut", () => {
  assert.equal(normalizeThemeId("luxury-rose"), "maison");
  assert.equal(normalizeThemeId("noir-gold"), "champagne");
  assert.equal(normalizeThemeId("pearl-minimal"), "galerie");
  assert.equal(normalizeThemeId("violet"), "violet");
  assert.equal(normalizeThemeId("n'importe"), DEFAULT_THEME_ID);
  assert.equal(normalizeThemeId(null), DEFAULT_THEME_ID);
  assert.equal(getShopTheme("midnight-navy").id, "ciel");
});

test("thèmes : contrastes lisibles (texte 4,5:1) pour chaque thème et chaque accent", () => {
  for (const t of SHOP_THEMES) {
    assert.ok(contrast(t.ink, t.bg) >= 7, `${t.id} encre/fond`);
    assert.ok(contrast(t.ink, t.surface) >= 7, `${t.id} encre/carte`);
    assert.ok(contrast(t.muted, t.bg) >= 4.5, `${t.id} texte secondaire/fond ${contrast(t.muted, t.bg).toFixed(2)}`);
    assert.ok(contrast(t.muted, t.soft) >= 4.5, `${t.id} texte secondaire/fond doux ${contrast(t.muted, t.soft).toFixed(2)}`);
    assert.ok(contrast(t.darkInk, t.dark) >= 7, `${t.id} section foncée`);
    assert.ok(contrast(t.darkAccent, t.dark) >= 4.5, `${t.id} accent sur section foncée ${contrast(t.darkAccent, t.dark).toFixed(2)}`);
    assert.ok(contrast(t.footerInk, t.footer) >= 4.5, `${t.id} pied de page`);
    for (const a of t.accents) {
      assert.ok(contrast(a, t.bg) >= 4.5, `${t.id} accent ${a} sur fond ${contrast(a, t.bg).toFixed(2)}`);
      assert.ok(contrast(a, t.soft) >= 4.5, `${t.id} accent ${a} sur fond doux ${contrast(a, t.soft).toFixed(2)}`);
      assert.ok(contrast("#FFFFFF", a) >= 4.5, `${t.id} blanc sur accent ${a} ${contrast("#FFFFFF", a).toFixed(2)}`);
    }
  }
});

test("apparence : accent, mise en avant, typographie et sections normalisés", () => {
  const l = shopLook({ theme: "ciel", accent: 2, hero: "banner", typo: "classique", hidden: ["reviews", "x", "steps"] });
  assert.equal(l.theme.id, "ciel");
  assert.equal(l.accent, "#A23D62");
  assert.equal(l.hero, "banner");
  assert.equal(l.vars["--s-display"].startsWith("var(--font-playfair)"), true);
  assert.deepEqual(l.hidden, ["steps", "reviews"]);
  const d = shopLook({ theme: null, accent: 9, hero: "?", typo: "?" });
  assert.equal(d.theme.id, "maison");
  assert.equal(d.accent, d.theme.accents[0]);
  assert.equal(d.hero, "portrait");
  assert.equal(d.typo, "theme");
  assert.deepEqual(normalizeHidden("services"), []);
});
