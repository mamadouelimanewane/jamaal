import { test } from "node:test";
import assert from "node:assert/strict";
import { adviceFor, analysisPrompt, isSkincare, mergeRoutine, parseAnalysis, parseAnswers, routineText, ruleRoutine, type CatalogItem } from "../skin/advisor";
import { imageModels, visionConfigured } from "../ai/gemini";

const P = (id: string, name: string, desc = "", category = "soins-visage"): CatalogItem => ({ id, slug: id, name, category, categoryLabel: "Soins visage", shortDescription: desc, price: 10000, photo: null });
const CAT = [
  P("n1", "Aurodhea Gel nettoyant visage", "purifiant, peaux mixtes à grasses"),
  P("n2", "Lait démaquillant douceur", "peaux sensibles, apaisant"),
  P("s1", "Aurodhea Sérum éclat vitamine C", "unifie le teint, atténue les taches"),
  P("s2", "Sérum anti-rides collagène", "fermeté"),
  P("j1", "Aurodhea Crème visage jour SPF 15", "hydratante, protège du soleil"),
  P("nu1", "Crème de nuit régénérante", "nourrissante au karité"),
  P("c1", "Contour des yeux", "cernes et poches"),
  P("m1", "Masque purifiant à l'argile", "pores, imperfections"),
];

test("questionnaire : réponses nettoyées (valeurs inconnues ignorées, 5 préoccupations au plus)", () => {
  const a = parseAnswers({ skinType: "grasse", concerns: ["taches", "x", "boutons", "taches"], sun: "souvent", age: "bof" });
  assert.deepEqual(a, { skinType: "grasse", concerns: ["taches", "boutons"], sun: "souvent", age: null });
  assert.equal(parseAnswers({ skinType: "verte" }).skinType, null);
});

test("soins du visage : parfums, gels douche et produits maison exclus", () => {
  assert.equal(isSkincare(P("a", "Crème visage hydratante")), true);
  assert.equal(isSkincare({ name: "Aurodhea sérum", category: "beaute", categoryLabel: "Beauté", shortDescription: "" }), true);
  assert.equal(isSkincare({ name: "Aqua Soul", category: "parfum-homme", categoryLabel: "Parfums homme", shortDescription: "eau de parfum pour la peau" }), false);
  assert.equal(isSkincare({ name: "Gel douche vanille", category: "gels-douche", categoryLabel: "Gels douche", shortDescription: "hydrate la peau" }), false);
  assert.equal(isSkincare({ name: "Nettoyant sols", category: "maison", categoryLabel: "Entretien maison", shortDescription: "" }), false);
});

test("routine sans IA : une étape = un produit adapté, taches → sérum éclat, SPF le matin", () => {
  const r = ruleRoutine({ skinType: "grasse", concerns: ["taches", "cernes"], sun: "souvent", age: null }, CAT);
  assert.deepEqual(r.matin.map((s) => s.product?.id), ["n1", "s1", "j1"]);
  assert.deepEqual(r.soir.map((s) => s.product?.id), ["n1", "nu1", "c1"]);
  assert.equal(r.hebdo[0].product?.id, "m1");
  const sensible = ruleRoutine({ skinType: "sensible", concerns: [], sun: null, age: null }, CAT);
  assert.equal(sensible.matin[0].product?.id, "n2");
  assert.equal(sensible.matin.length, 2); // pas de sérum sans préoccupation
  assert.equal(ruleRoutine({ skinType: "normale", concerns: [], sun: null, age: null }, []).matin[0].product, null);
});

test("conseils : jamais d'éclaircissant, SPF toujours, rasage si poils incarnés", () => {
  const adv = adviceFor({ skinType: "seche", concerns: ["taches", "poils"], sun: null, age: null }).join(" ");
  assert.match(adv, /Protection solaire/);
  assert.match(adv, /éclaircissantes/);
  assert.match(adv, /Rasez/);
  assert.match(adv, /gris/);
});

test("prompt : consignes peaux noires et catalogue limité aux identifiants fournis", () => {
  const p = analysisPrompt({ skinType: null, concerns: ["taches"], sun: null, age: null }, CAT);
  assert.match(p, /phototypes IV à VI/);
  assert.match(p, /Ne recommande jamais d'éclaircir/);
  assert.match(p, /s1 \| Aurodhea Sérum éclat/);
});

test("analyse IA : validée, identifiants inconnus et doublons ignorés, photo refusée expliquée", () => {
  const ids = new Set(CAT.map((p) => p.id));
  const r = parseAnalysis({ ok: true, skinType: "mixte", summary: "Belle peau.", scores: { hydratation: 140, eclat: "60", uniformite: -5 }, concerns: [{ label: "Taches", detail: "Quelques marques" }], picks: { nettoyant: { productId: "n2", why: "doux" }, serum: { productId: "zzz" }, jour: { productId: "n2" } }, advice: ["SPF"] }, ids);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.analysis.scores.hydratation, 100);
  assert.equal(r.analysis.scores.uniformite, 0);
  assert.equal(r.analysis.scores.eclat, 60);
  assert.deepEqual(Object.keys(r.analysis.picks), ["nettoyant"]);
  const refused = parseAnalysis({ ok: false, reason: "Photo trop sombre." }, ids);
  assert.deepEqual(refused, { ok: false, reason: "Photo trop sombre." });
  assert.equal(parseAnalysis("x", ids).ok, false);
});

test("routine finale : choix de l'IA prioritaire, étapes ajoutées dans l'ordre", () => {
  const base = ruleRoutine({ skinType: "normale", concerns: [], sun: null, age: null }, CAT);
  const parsed = parseAnalysis({ ok: true, picks: { nettoyant: { productId: "n2", why: "doux" }, serum: { productId: "s2", why: "fermeté" }, contour: { productId: "c1" } } }, new Set(CAT.map((p) => p.id)));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const r = mergeRoutine(base, parsed.analysis, CAT);
  assert.deepEqual(r.matin.map((s) => s.step), ["nettoyant", "serum", "jour"]);
  assert.equal(r.matin[0].product?.id, "n2");
  assert.equal(r.matin[1].product?.id, "s2");
  assert.ok(r.soir.some((s) => s.step === "contour" && s.product?.id === "c1"));
  const text = routineText(r, "https://j.sn", "awa");
  assert.match(text, /☀️ Matin\n• Nettoyer : Lait démaquillant douceur — https:\/\/j\.sn\/produits\/n2\?ref=awa/);
});

test("IA : analyse photo seulement avec un fournisseur qui lit les images ; modèles d'image", () => {
  assert.equal(visionConfigured({ GOOGLE_AI_API_KEY: "k" }), true);
  assert.equal(visionConfigured({ AI_API_KEY: "k", AI_PROVIDER: "deepseek" }), false);
  assert.equal(visionConfigured({ AI_API_KEY: "k", AI_PROVIDER: "openai" }), true);
  assert.equal(imageModels({ GEMINI_IMAGE_MODEL: "x" })[0], "x");
  assert.ok(imageModels({}).includes("gemini-2.5-flash-image"));
});
