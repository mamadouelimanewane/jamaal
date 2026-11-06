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
