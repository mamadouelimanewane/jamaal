import { test } from "node:test";
import assert from "node:assert/strict";
import { runAssistant, sanitizeHistory, systemPrompt, type Generate } from "../ai/assistant";
import { orderScope, runTool, toolsFor, type AssistantScope } from "../ai/assistant-tools";
import type { GeminiContent, GeminiRequest } from "../ai/gemini";

const admin: AssistantScope = { role: "ADMIN", userId: "u1", consultantId: null, livreurId: null };
const consultant: AssistantScope = { role: "CONSULTANT", userId: "u2", consultantId: "c1", livreurId: null };
const livreur: AssistantScope = { role: "LIVREUR", userId: "u3", consultantId: null, livreurId: "l1" };

test("les outils proposés dépendent du rôle", () => {
  const names = (s: AssistantScope) => toolsFor(s).map((t) => t.name).sort();
  assert.ok(names(admin).includes("chercher_revendeurs"));
  assert.ok(names(admin).includes("mouvements_stock"));
  assert.deepEqual(names(consultant), ["chercher_clients", "chercher_commandes", "etat_stock", "rechercher_produits", "resume_ventes"]);
  assert.deepEqual(names(livreur), ["chercher_commandes", "etat_stock", "rechercher_produits"]);
});

test("un outil réservé à l'admin est refusé même si le modèle l'appelle", async () => {
  const r = await runTool("chercher_revendeurs", {}, consultant);
  assert.match(String(r.erreur), /non disponible/);
  const unknown = await runTool("supprimer_tout", {}, admin);
  assert.match(String(unknown.erreur), /non disponible/);
});

test("les commandes sont filtrées sur le revendeur ou le livreur", () => {
  assert.deepEqual(orderScope(admin), {});
  assert.deepEqual(orderScope(consultant), { consultantId: "c1" });
  assert.deepEqual(orderScope(livreur), { livreurId: "l1" });
  // Compte sans fiche : aucune commande plutôt que toutes.
  assert.deepEqual(orderScope({ ...consultant, consultantId: null }), { consultantId: "__aucun__" });
});

test("l'historique est borné et finit par une question", () => {
  assert.deepEqual(sanitizeHistory([{ role: "assistant", text: "Bonjour" }]), []);
  const long = sanitizeHistory([{ role: "user", text: "x".repeat(5000) }]);
  assert.equal((long[0].parts[0] as { text: string }).text.length, 1000);
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `m${i}` }) as const);
  const out = sanitizeHistory([...many, { role: "user", text: "fin" }]);
  assert.ok(out.length <= 12);
  assert.equal(out[0].role, "user");
  assert.equal(out[out.length - 1].role, "user");
});

test("le prompt système liste les pages du rôle seulement", () => {
  assert.match(systemPrompt(admin), /\/admin\/comptabilite/);
  assert.doesNotMatch(systemPrompt(consultant), /\/admin\/comptabilite/);
  assert.match(systemPrompt(consultant), /\/admin\/mes-clients/);
});

test("boucle : appel d'outil puis réponse finale", async () => {
  const seen: GeminiRequest[] = [];
  const replies: GeminiContent[] = [
    { role: "model", parts: [{ functionCall: { name: "etat_stock", args: { filtre: "rupture" } }, thoughtSignature: "sig" }] },
    { role: "model", parts: [{ text: "2 produits sont en rupture." }] },
  ];
  const generate: Generate = async (req) => {
    seen.push(structuredClone(req));
    return replies.shift()!;
  };
  const calls: string[] = [];
  const answer = await runAssistant(admin, [{ role: "user", text: "Ruptures ?" }], {
    generate,
    runTool: async (name, args, scope) => {
      calls.push(`${name}:${JSON.stringify(args)}:${scope.role}`);
      return { resultat: { lignes: [] } };
    },
  });
  assert.equal(answer.text, "2 produits sont en rupture.");
  assert.deepEqual(answer.toolsUsed, ["etat_stock"]);
  assert.deepEqual(calls, ['etat_stock:{"filtre":"rupture"}:ADMIN']);
  // Deuxième appel : la réponse du modèle (avec sa signature) puis le résultat de l'outil.
  const second = seen[1].contents;
  assert.equal(second.length, 3);
  assert.deepEqual(second[1].parts[0], { functionCall: { name: "etat_stock", args: { filtre: "rupture" } }, thoughtSignature: "sig" });
  assert.equal(second[2].role, "user");
  assert.ok("functionResponse" in second[2].parts[0]);
});

test("boucle : le nombre de tours d'outils est limité", async () => {
  let n = 0;
  const generate: Generate = async (req) => {
    n++;
    if (!req.tools) return { role: "model", parts: [{ text: "Voici ce que j'ai trouvé." }] };
    return { role: "model", parts: [{ functionCall: { name: "etat_stock", args: {} } }] };
  };
  const answer = await runAssistant(admin, [{ role: "user", text: "?" }], { generate, runTool: async () => ({ resultat: {} }) });
  assert.equal(answer.text, "Voici ce que j'ai trouvé.");
  assert.equal(n, 6);
});

test("boucle : à court de temps, le modèle conclut sans outils", async () => {
  let t = 0;
  const seen: GeminiRequest[] = [];
  const generate: Generate = async (req) => {
    seen.push(req);
    t += 40_000; // chaque appel « dure » 40 s
    return req.tools
      ? { role: "model", parts: [{ functionCall: { name: "etat_stock", args: {} } }] }
      : { role: "model", parts: [{ text: "Voici ce que j'ai trouvé." }] };
  };
  const answer = await runAssistant(admin, [{ role: "user", text: "Stock ?" }], {
    generate,
    now: () => t,
    runTool: async () => ({ resultat: {} }),
  });
  assert.equal(seen.length, 2);
  assert.ok(seen[0].tools?.length);
  assert.equal(seen[1].tools, undefined);
  assert.equal(seen[1].thinking, "low");
  assert.equal(answer.text, "Voici ce que j'ai trouvé.");
});
