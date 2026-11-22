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
  assert.equal(formatMru(147000, 14.7).replace(/\s/g, " "), "10 000 أوقية");
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
