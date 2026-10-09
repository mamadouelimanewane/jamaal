import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryFromHref, DEFAULT_SLIDES, MAX_SLIDES, normalizeSlides } from "../home-slides";

test("carrousel : valeurs par défaut pour des données absentes ou abîmées", () => {
  assert.equal(normalizeSlides(null), DEFAULT_SLIDES);
  assert.equal(normalizeSlides("x"), DEFAULT_SLIDES);
  assert.ok(DEFAULT_SLIDES.length >= 5);
  assert.ok(DEFAULT_SLIDES.every((s) => s.active && s.title && s.href.startsWith("/collections/")));
});

test("carrousel : nettoyage des diapositives", () => {
  const out = normalizeSlides([
    { id: "a b!", title: "  Slogan  ", href: "javascript:alert(1)", image: "data:x", theme: "inconnu", ctaLabel: "" },
    { id: "b", title: "" },
    { id: "c", title: "Ok", href: "//evil.com", active: false },
    { id: "d", title: "Externe", href: "https://chogan.it", image: "https://exemple.sn/a.jpg" },
  ]);
  assert.equal(out.length, 3);
  assert.deepEqual([out[0].id, out[0].title, out[0].href, out[0].image, out[0].theme, out[0].ctaLabel], ["ab", "Slogan", "/", "", "nuit", "Découvrir"]);
  assert.equal(out[1].href, "/");
  assert.equal(out[1].active, false);
  assert.equal(out[2].href, "https://chogan.it");
  assert.equal(out[2].image, "https://exemple.sn/a.jpg");
  assert.equal(normalizeSlides(Array.from({ length: 15 }, (_, i) => ({ id: `s${i}`, title: "x" }))).length, MAX_SLIDES);
});

test("carrousel : gamme visée par le lien", () => {
  assert.equal(categoryFromHref("/collections/soins-visage"), "soins-visage");
  assert.equal(categoryFromHref("/collections/maquillage?tri=prix"), "maquillage");
  assert.equal(categoryFromHref("/produits/x"), null);
});
