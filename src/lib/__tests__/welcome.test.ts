import { test } from "node:test";
import assert from "node:assert/strict";
import { welcomeMessage, welcomeTemplateVars } from "../whatsapp/welcome";
import { buildMetaPayload } from "../whatsapp/meta";

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

test("modèle dédié : une variable par champ, sans retour à la ligne", () => {
  const vars = welcomeTemplateVars({ name: "Awa Diop", slug: "awa-diop", sponsorName: null }, "https://jamaal-nine.vercel.app");
  assert.deepEqual(vars, ["Awa", "JAMAAL", "https://jamaal-nine.vercel.app/c/awa-diop"]);
  const p = buildMetaPayload("221770000000", "texte complet", { template: "bienvenue_revendeur", templateVars: ["Awa", "Fatou\nNdiaye", "https://x.sn/c/awa"] }, "jamaal_alerte", "fr") as {
    type: string;
    template: { name: string; components: { parameters: { text: string }[] }[] };
  };
  assert.equal(p.type, "template");
  assert.equal(p.template.name, "bienvenue_revendeur");
  assert.deepEqual(p.template.components[0].parameters.map((x) => x.text), ["Awa", "Fatou Ndiaye", "https://x.sn/c/awa"]);
  // Sans variables : comportement d'origine (tout le texte dans {{1}}).
  const old = buildMetaPayload("221770000000", "Bonjour A", {}, "jamaal_alerte", "fr") as { template: { components: { parameters: unknown[] }[] } };
  assert.equal(old.template.components[0].parameters.length, 1);
});
