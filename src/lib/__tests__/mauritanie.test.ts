import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMru, formatPrice, priceFormatter, toMru, MRU_DEFAULT_RATE } from "../currency";
import { isMauritanianNumber } from "../phone-country";

test("numéro mauritanien : +222 suivi de 8 chiffres", () => {
  assert.equal(isMauritanianNumber("+222 22 12 34 56"), true);
  assert.equal(isMauritanianNumber("0022246123456"), true);
  assert.equal(isMauritanianNumber("22236123456"), true);
  assert.equal(isMauritanianNumber("+221 71 180 09 09"), false);
  assert.equal(isMauritanianNumber("+222 12 34 56"), false);
  assert.equal(isMauritanianNumber(""), false);
  assert.equal(isMauritanianNumber(null), false);
});

test("ouguiya : conversion depuis le FCFA, arrondie à l'ouguiya", () => {
  assert.equal(toMru(14800, 14.7), 1007);
  assert.equal(toMru(14700, 14.7), 1000);
  assert.equal(toMru(14800, 0), Math.round(14800 / MRU_DEFAULT_RATE));
  assert.equal(formatMru(147000, 14.7).replace(/[\u2066\u2069]/g, "").replace(/\s/g, " "), "10 000 MRU");
  assert.equal(priceFormatter("ar", 14.7)(14700), formatMru(14700, 14.7));
  assert.equal(priceFormatter("fr", 14.7)(14800), formatPrice(14800));
  assert.equal(priceFormatter("it")(14800), formatPrice(14800));
});

test("numéro saisi par un client : +222 ou 8 chiffres locaux, jamais un numéro sénégalais", async () => {
  const { looksMauritanian } = await import("../phone-country");
  assert.equal(looksMauritanian("+222 46 12 34 56"), true);
  assert.equal(looksMauritanian("46 12 34 56"), true);
  assert.equal(looksMauritanian("22123456"), true);
  assert.equal(looksMauritanian("77 123 45 67"), false);
  assert.equal(looksMauritanian("+221 77 123 45 67"), false);
  assert.equal(looksMauritanian("56 12 34 56"), false);
  assert.equal(looksMauritanian(""), false);
});

test("le flux catalogue Meta n'est jamais bloqué par la protection anti-robots", async () => {
  const { isMachinePath } = await import("../bot-guard");
  assert.equal(isMachinePath("/api/meta/catalog"), true);
});

test("catalogue Meta d'un revendeur : son code sur chaque lien produit", async () => {
  const { catalogProductLink, cleanRef, resellerCatalogUrl } = await import("../meta-catalog");
  assert.equal(catalogProductLink("https://www.jamaal.sn", "zeus", null), "https://www.jamaal.sn/produits/zeus");
  assert.equal(
    catalogProductLink("https://www.jamaal.sn/", "zeus", "aissatou"),
    "https://www.jamaal.sn/produits/zeus?ref=aissatou&utm_source=facebook&utm_medium=paid&utm_campaign=catalogue-revendeur",
  );
  assert.equal(cleanRef(" Aissatou "), "aissatou");
  assert.equal(cleanRef("<script>"), null);
  assert.equal(cleanRef(""), null);
  assert.equal(resellerCatalogUrl("https://www.jamaal.sn", "awa-parfums"), "https://www.jamaal.sn/api/meta/catalog?ref=awa-parfums");
});

test("Gambie : numéro +220, dalasi, langue proposée selon le numéro", async () => {
  const { isGambianNumber, looksGambian, languageForPhone, shopLanguageForNumber } = await import("../phone-country");
  const { formatGmd, toGmd, priceFormatter } = await import("../currency");
  assert.equal(isGambianNumber("+220 770 12 34"), true);
  assert.equal(isGambianNumber("00220 3012345"), true);
  assert.equal(isGambianNumber("+221 77 123 45 67"), false);
  assert.equal(looksGambian("770 12 34"), true);
  assert.equal(looksGambian("77 123 45 67"), false);
  assert.equal(languageForPhone("+220 770 12 34"), "en");
  assert.equal(languageForPhone("+222 46 12 34 56"), "ar");
  assert.equal(languageForPhone("77 123 45 67"), null);
  assert.equal(shopLanguageForNumber("+220 770 12 34"), "en");
  assert.equal(shopLanguageForNumber("770 12 34"), null);
  assert.equal(toGmd(14800, 8.1), 1827);
  assert.equal(formatGmd(148000, 8.1), "18,272 GMD");
  assert.equal(priceFormatter("en", 8.1)(14800), "1,827 GMD");
  assert.equal(priceFormatter("en")(8100), "1,000 GMD");
});
