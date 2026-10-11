import { test } from "node:test";
import assert from "node:assert/strict";
import { availability, phoneKey, SHOP_TOOLS, shopSystemPrompt } from "../ai/shop-assistant";
import { runChat, type Generate } from "../ai/assistant";
import type { GeminiContent, GeminiRequest } from "../ai/gemini";

test("le téléphone est comparé sur ses 9 derniers chiffres", () => {
  assert.equal(phoneKey("+221 77 000 11 22"), "770001122");
  assert.equal(phoneKey("00221770001122"), "770001122");
  assert.equal(phoneKey("77 000 11 22"), "770001122");
  assert.equal(phoneKey("1234"), "");
});

test("la disponibilité ne dit jamais « rupture » et ne détaille pas un gros stock", () => {
  assert.equal(availability(0), "produit en cours de commande (réservable)");
  assert.equal(availability(-2), "produit en cours de commande (réservable)");
  assert.equal(availability(2), "plus que 2 en stock");
  assert.equal(availability(40), "en stock");
});

test("le suivi de commande exige numéro et téléphone", () => {
  const suivi = SHOP_TOOLS.find((t) => t.name === "suivi_commande");
  assert.deepEqual((suivi?.parameters as { required: string[] }).required, ["numero", "telephone"]);
  assert.deepEqual(SHOP_TOOLS.map((t) => t.name).sort(), ["infos_boutique", "rechercher_produits", "suivi_commande"]);
});

test("aucun outil ne déclare un objet de paramètres vide (refusé par Gemini)", () => {
  for (const t of SHOP_TOOLS) {
    const props = (t.parameters as { properties?: Record<string, unknown> } | undefined)?.properties;
    if (t.parameters) assert.ok(props && Object.keys(props).length > 0, t.name);
  }
});

test("les consignes cadrent la conseillère", () => {
  const p = shopSystemPrompt(new Date("2026-10-11"));
  assert.match(p, /2026-10-11/);
  assert.match(p, /n'invente jamais/);
  assert.match(p, /en cours de commande/);
  assert.match(p, /WhatsApp/);
  assert.match(p, /mot de passe/);
});

test("boucle boutique : outil appelé puis réponse", async () => {
  const seen: GeminiRequest[] = [];
  const replies: GeminiContent[] = [
    { role: "model", parts: [{ functionCall: { name: "rechercher_produits", args: { requete: "frais homme" } } }] },
    { role: "model", parts: [{ text: "Je vous conseille [Aftertouch](/produits/aftertouch)." }] },
  ];
  const generate: Generate = async (req) => {
    seen.push(req);
    return replies.shift()!;
  };
  const calls: string[] = [];
  const answer = await runChat({
    system: shopSystemPrompt(),
    tools: SHOP_TOOLS,
    exec: async (name, args) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return { resultat: { produits: [] } };
    },
    history: [{ role: "user", text: "Un parfum frais pour homme" }],
    generate,
  });
  assert.equal(answer.text, "Je vous conseille [Aftertouch](/produits/aftertouch).");
  assert.deepEqual(calls, ['rechercher_produits:{"requete":"frais homme"}']);
  assert.equal(seen[0].tools?.length, 3);
});
