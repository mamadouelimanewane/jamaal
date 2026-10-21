import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveSponsorCode, inviteCode } from "../invite-lock";

test("invitation : le code du lien est imposé, quel que soit le code tapé", () => {
  assert.equal(effectiveSponsorCode("moussa", "autre"), "moussa");
  assert.equal(effectiveSponsorCode("MOUSSA", ""), "moussa");
});

test("invitation : sans lien, le code tapé est gardé", () => {
  assert.equal(effectiveSponsorCode(undefined, "aminata"), "aminata");
  assert.equal(effectiveSponsorCode("", "aminata"), "aminata");
});

test("invitation : un cookie mal formé est ignoré", () => {
  assert.equal(inviteCode("<script>"), "");
  assert.equal(inviteCode("a"), "");
  assert.equal(effectiveSponsorCode("x y", "aminata"), "aminata");
});
