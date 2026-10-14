import { test } from "node:test";
import assert from "node:assert/strict";
import { welcomeMessage } from "../whatsapp/welcome";

test("message de bienvenue : prénom, parrain, lien personnel et bouton", () => {
  const m = welcomeMessage({ name: "Awa Diop", slug: "awa-diop", sponsorName: "Fatou Ndiaye" }, "https://jamaal-nine.vercel.app");
  assert.match(m.text, /^Bienvenue chez JAMAAL, Awa !/);
  assert.match(m.text, /équipe de Fatou Ndiaye/);
  assert.match(m.text, /https:\/\/jamaal-nine\.vercel\.app\/c\/awa-diop/);
  assert.deepEqual(m.cta, { label: "Ouvrir mon espace", url: "https://jamaal-nine.vercel.app/admin/login" });
});

test("sans parrain ni lien : message cohérent et aucun lien d'activation", () => {
  const m = welcomeMessage({ name: "Moussa", slug: null, sponsorName: null }, "");
  assert.match(m.text, /revendeur officiel Chogan/);
  assert.doesNotMatch(m.text, /undefined|null|reset-password|token/);
});
