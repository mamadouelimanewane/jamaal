import { test } from "node:test";
import assert from "node:assert/strict";
import { localizeHref, splitLocale, isLocalizablePath } from "../i18n/config";
import { translator } from "../i18n/translate";
import { familyIt, noteIt } from "../i18n/notes-it";
import { genericIt } from "../i18n/product";

test("adresses /it du site vitrine", () => {
  assert.deepEqual(splitLocale("/it/produits/x"), { locale: "it", path: "/produits/x" });
  assert.deepEqual(splitLocale("/it"), { locale: "it", path: "/" });
  assert.deepEqual(splitLocale("/italie"), { locale: "fr", path: "/italie" });
  assert.equal(localizeHref("/", "it"), "/it");
  assert.equal(localizeHref("/collections?x=1", "it"), "/it/collections?x=1");
  assert.equal(localizeHref("/admin", "it"), "/admin");
  assert.equal(localizeHref("/c/awa", "it"), "/c/awa");
  assert.equal(localizeHref("https://wa.me/1", "it"), "https://wa.me/1");
  assert.equal(localizeHref("/it/panier", "it"), "/it/panier");
  assert.equal(localizeHref("/panier", "fr"), "/panier");
  assert.equal(isLocalizablePath("/logo/a.png"), false);
});

test("traduction : clé française, repli sur le français, espaces et paramètres", () => {
  const it = translator("it");
  assert.equal(it("Ajouter au panier"), "Aggiungi al carrello");
  assert.equal(it("Texte inconnu"), "Texte inconnu");
  assert.equal(it(" Ajouter "), " Aggiungi ");
  assert.equal(it("Plus que {stock} en stock", { stock: 2 }), "Solo 2 disponibili");
  assert.equal(translator("fr")("Plus que {stock} en stock", { stock: 2 }), "Plus que 2 en stock");
});

test("notes, familles et descriptions types en italien", () => {
  assert.equal(noteIt("Fève tonka"), "Fava tonka");
  assert.equal(noteIt("Note inventée"), "Note inventée");
  assert.equal(familyIt("Floral boisé"), "Floreale legnoso");
  assert.equal(familyIt("Inconnu"), "Inconnu");
  assert.equal(genericIt("Prestige — 70 ml. Produit Chogan, distribué au Sénégal par JAMAAL."), "Prestige — 70 ml. Prodotto Chogan, distribuito in Senegal da JAMAAL.");
});

test("arabe : adresses /ar, passage d'une langue à l'autre, écriture de droite à gauche", async () => {
  const { dirOf } = await import("../i18n/config");
  assert.deepEqual(splitLocale("/ar/produits/x"), { locale: "ar", path: "/produits/x" });
  assert.deepEqual(splitLocale("/ar"), { locale: "ar", path: "/" });
  assert.deepEqual(splitLocale("/arbre"), { locale: "fr", path: "/arbre" });
  assert.equal(localizeHref("/", "ar"), "/ar");
  assert.equal(localizeHref("/collections?x=1", "ar"), "/ar/collections?x=1");
  assert.equal(localizeHref("/it/panier", "ar"), "/ar/panier");
  assert.equal(localizeHref("/ar/panier", "it"), "/it/panier");
  assert.equal(localizeHref("/ar/panier", "fr"), "/panier");
  assert.equal(localizeHref("/admin", "ar"), "/admin");
  assert.equal(dirOf("ar"), "rtl");
  assert.equal(dirOf("it"), "ltr");
});

test("arabe : textes, variables, notes et descriptions types", async () => {
  const { noteAr, familyAr } = await import("../i18n/notes-ar");
  const { genericAr } = await import("../i18n/product");
  const ar = translator("ar");
  assert.equal(ar("Ajouter au panier"), "أضف إلى السلة");
  assert.equal(ar("Plus que {stock} en stock", { stock: 2 }), "لم يتبقَّ سوى 2 في المخزون");
  assert.equal(ar("Texte inconnu"), "Texte inconnu");
  assert.equal(noteAr("Oud"), "العود");
  assert.equal(familyAr("Floral boisé"), "زهري خشبي");
  assert.equal(genericAr("Prestige — 70 ml. Produit Chogan, distribué au Sénégal par JAMAAL."), "Prestige — 70 ml. منتج Chogan، توزّعه JAMAAL في السنغال.");
});

test("arabe : chaque phrase du site est traduite, avec les mêmes variables", async () => {
  const { IT } = await import("../i18n/it");
  const { AR } = await import("../i18n/ar");
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).filter((v) => v !== "{v1}" || !/étoile\{v1\}/.test(s)).sort().join(",");
  for (const fr of Object.keys(IT)) {
    assert.ok(fr in AR, `traduction arabe manquante : ${fr}`);
    if (fr !== "{n} étoile{v1}") assert.equal(vars(AR[fr]), vars(fr), fr);
  }
});

test("anglais (Gambie) : adresses /en, passage d'une langue à l'autre", async () => {
  const { dirOf, convertsPrices } = await import("../i18n/config");
  assert.deepEqual(splitLocale("/en/produits/x"), { locale: "en", path: "/produits/x" });
  assert.deepEqual(splitLocale("/en"), { locale: "en", path: "/" });
  assert.deepEqual(splitLocale("/entretien"), { locale: "fr", path: "/entretien" });
  assert.equal(localizeHref("/panier", "en"), "/en/panier");
  assert.equal(localizeHref("/ar/panier", "en"), "/en/panier");
  assert.equal(localizeHref("/en/panier", "fr"), "/panier");
  assert.equal(localizeHref("/admin", "en"), "/admin");
  assert.equal(dirOf("en"), "ltr");
  assert.equal(convertsPrices("en"), true);
  assert.equal(convertsPrices("it"), false);
});

test("anglais : textes, notes, familles et phrases types", async () => {
  const { noteEn, familyEn } = await import("../i18n/notes-en");
  const { genericEn } = await import("../i18n/product");
  const en = translator("en");
  assert.equal(en("Ajouter au panier"), "Add to cart");
  assert.equal(en("Plus que {stock} en stock", { stock: 2 }), "Only 2 left in stock");
  assert.equal(en("Texte inconnu"), "Texte inconnu");
  assert.equal(noteEn("Fève tonka"), "Tonka bean");
  assert.equal(familyEn("Floral boisé"), "Floral woody");
  assert.equal(genericEn("Prestige — 70 ml. Produit Chogan, distribué au Sénégal par JAMAAL."), "Prestige — 70 ml. Chogan product, distributed in Senegal and The Gambia by JAMAAL.");
});

test("anglais : chaque phrase du site (et de la boutique revendeur) est traduite, avec les mêmes variables", async () => {
  const { AR } = await import("../i18n/ar");
  const { EN } = await import("../i18n/en");
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const fr of Object.keys(AR)) {
    assert.ok(fr in EN, `traduction anglaise manquante : ${fr}`);
    assert.equal(vars(EN[fr]), vars(fr), fr);
  }
});

test("délai de réservation saisi dans l'admin, dans la langue de la page", async () => {
  const { localizeDelay } = await import("../i18n/translate");
  assert.equal(localizeDelay("15 à 21 jours", translator("en")), "15 to 21 days");
  assert.equal(localizeDelay("15 à 21 jours", translator("fr")), "15 à 21 jours");
  assert.equal(localizeDelay("10 jours", translator("en")), "10 days");
  assert.equal(localizeDelay("Sous 3 semaines", translator("en")), "Sous 3 semaines");
});
