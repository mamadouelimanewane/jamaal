import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLoginIdentifier } from "../login-identifier";

test("reconnaît un e-mail et le normalise en minuscules", () => {
  assert.deepEqual(parseLoginIdentifier("Awa@Exemple.com"), { kind: "email", value: "awa@exemple.com" });
});

test("reconnaît un numéro de téléphone et le normalise (chiffres uniquement, sans 00)", () => {
  assert.deepEqual(parseLoginIdentifier("00221 77 000 00 00"), { kind: "phone", value: "221770000000" });
  assert.deepEqual(parseLoginIdentifier("+221 77 000 00 00"), { kind: "phone", value: "221770000000" });
  assert.deepEqual(parseLoginIdentifier("77 000 00 00"), { kind: "phone", value: "770000000" });
});

test("rejette une saisie vide ou trop courte", () => {
  assert.equal(parseLoginIdentifier(""), null);
  assert.equal(parseLoginIdentifier("   "), null);
  assert.equal(parseLoginIdentifier("123"), null);
});

test("rejette un e-mail trop long", () => {
  const long = `${"a".repeat(250)}@x.com`;
  assert.equal(parseLoginIdentifier(long), null);
});

test("rejette un numéro trop long", () => {
  assert.equal(parseLoginIdentifier("1".repeat(20)), null);
});
