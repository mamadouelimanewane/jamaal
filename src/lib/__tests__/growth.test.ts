import { test } from "node:test";
import assert from "node:assert/strict";
import { offerDiscount } from "../offers";
import { optCommand, toWhatsAppText } from "../whatsapp/format";
import { pickFormat } from "../ai/whatsapp-sales";

test("offre de fêtes : coffret appliqué si tous les produits sont au panier, la meilleure offre gagne", () => {
  const tabaski = { id: "o1", title: "Coffret Tabaski", productIds: ["a", "b"], packPrice: 25_000 };
  const duo = { id: "o2", title: "Duo", productIds: ["a", "c"], packPrice: 30_000 };
  // a (16 300) + b (14 000) = 30 300 → remise 5 300
  assert.deepEqual(offerDiscount([tabaski], [{ productId: "a", price: 16_300, quantity: 1 }, { productId: "b", price: 14_000, quantity: 1 }])?.discount, 5_300);
  // il manque b : pas de remise
  assert.equal(offerDiscount([tabaski], [{ productId: "a", price: 16_300, quantity: 2 }]), null);
  // deux coffrets complets
  const two = offerDiscount([tabaski], [{ productId: "a", price: 16_300, quantity: 2 }, { productId: "b", price: 14_000, quantity: 3 }]);
  assert.equal(two?.packs, 2);
  assert.equal(two?.discount, 10_600);
  // le format le moins cher du panier sert de valeur
  assert.equal(offerDiscount([tabaski], [{ productId: "a", price: 30_000, quantity: 1 }, { productId: "a", price: 16_300, quantity: 1 }, { productId: "b", price: 14_000, quantity: 1 }])?.discount, 5_300);
  // prix du coffret supérieur à la valeur : aucune remise
  assert.equal(offerDiscount([{ ...tabaski, packPrice: 40_000 }], [{ productId: "a", price: 16_300, quantity: 1 }, { productId: "b", price: 14_000, quantity: 1 }]), null);
  // deux offres possibles : la plus avantageuse
  const best = offerDiscount([tabaski, duo], [{ productId: "a", price: 16_300, quantity: 1 }, { productId: "b", price: 14_000, quantity: 1 }, { productId: "c", price: 20_000, quantity: 1 }]);
  assert.equal(best?.offer.id, "o2");
  assert.equal(best?.discount, 6_300);
});

test("WhatsApp : Markdown converti (gras, liens complets), STOP / START reconnus", () => {
  const out = toWhatsAppText("**Commande créée !**\n\n\n- Payer : [lien de paiement](/commande/abc)\n- Voir https://wa.me/1", "https://jamaal.sn");
  assert.equal(out, "*Commande créée !*\n\n• Payer : lien de paiement : https://jamaal.sn/commande/abc\n• Voir https://wa.me/1");
  assert.equal(toWhatsAppText("[https://jamaal.sn/x](https://jamaal.sn/x)", "https://jamaal.sn"), "https://jamaal.sn/x");
  assert.equal(optCommand("stop"), "STOP");
  assert.equal(optCommand(" Arrêter "), "STOP");
  assert.equal(optCommand("START"), "START");
  assert.equal(optCommand("stop la commande de mon frère"), null);
});

test("commande WhatsApp : format choisi au prix serveur, sinon question claire", () => {
  const p = { name: "Aqua Soul", regularPrice: 16_300, volumes: [{ label: "30 ml", price: 9_000 }, { label: "70 ml", price: 16_300 }] };
  assert.deepEqual(pickFormat(p, "70 ml"), { label: "70 ml", price: 16_300 });
  assert.deepEqual(pickFormat(p, "70ML"), { label: "70 ml", price: 16_300 });
  assert.match(String((pickFormat(p, "") as { error: string }).error), /Format à préciser.*30 ml \(9000 FCFA\), 70 ml/);
  assert.deepEqual(pickFormat({ name: "Savon", regularPrice: 5_000, volumes: null }, ""), { label: "Format unique", price: 5_000 });
  assert.deepEqual(pickFormat({ name: "Stick", regularPrice: 16_300, volumes: [{ label: "7 g", price: 16_300 }] }, "grand"), { label: "7 g", price: 16_300 });
});

test("codes promo : pourcentage plafonné, montant fixe jamais au-dessus du total", async () => {
  const { codeDiscount } = await import("../offers");
  assert.equal(codeDiscount("PERCENT", 10, 16_300), 1_630);
  assert.equal(codeDiscount("PERCENT", 150, 10_000), 9_000);
  assert.equal(codeDiscount("FIXED", 5_000, 3_000), 3_000);
  assert.equal(codeDiscount("FIXED", 0, 3_000), 0);
});

test("anniversaire : formats saisis acceptés, dates impossibles refusées", async () => {
  const { birthdayKey, birthdayLabel } = await import("../birthday");
  assert.equal(birthdayKey("14/03"), "03-14");
  assert.equal(birthdayKey("14/03/1990"), "03-14");
  assert.equal(birthdayKey("1990-03-14"), "03-14");
  assert.equal(birthdayKey("03-14"), "03-14");
  assert.equal(birthdayKey("29/02"), "02-29");
  assert.equal(birthdayKey("31/04"), null);
  assert.equal(birthdayKey("bonjour"), null);
  assert.equal(birthdayLabel("03-14"), "14 mars");
});

test("messages automatiques : prénom, produit, lien, STOP ; résumé du soir lisible", async () => {
  const { relance45Text, birthdayText, cartText } = await import("../automation/relances");
  const r = relance45Text({ firstName: "Awa", product: "Aqua Soul", link: "https://jamaal.sn/produits/aqua?ref=moussa", reseller: "Moussa Sarr" });
  assert.match(r, /Bonjour Awa/);
  assert.match(r, /\*Aqua Soul\*/);
  assert.match(r, /ref=moussa/);
  assert.match(r, /Moussa Sarr/);
  assert.match(r, /STOP/);
  assert.match(birthdayText({ firstName: "", code: "ANNIV-1234AB", days: 15, origin: "https://jamaal.sn" }), /^Joyeux anniversaire ! [\s\S]*ANNIV-1234AB[\s\S]*15 jours/);
  assert.match(cartText({ firstName: "Ndeye", items: ["A", "B", "C", "D"], origin: "https://jamaal.sn" }), /A, B, C…[\s\S]*\/panier/);
  const { summaryText } = await import("../automation/summary");
  const t = summaryText({ date: "12/10/2026", ordersToday: 3, revenueToday: 48_900, cashedToday: 32_600, revenueMonth: 1_250_000, toDeliver: 4, unpaidOld: 1, outOfStock: { count: 2, top: ["Rose Dust 70 ml"] }, inactiveResellers: { count: 6, names: ["A", "B"] }, reviewsPending: 2, priceChanges: 0, origin: "https://jamaal.sn" });
  assert.match(t, /3 commande\(s\), 48 900 FCFA/);
  assert.match(t, /1 250 000 FCFA/);
  assert.match(t, /Rose Dust 70 ml/);
  assert.match(t, /\(A, B…\)/);
  assert.match(t, /Avis à valider : 2/);
  assert.doesNotMatch(t, /Prix Chogan/);
});

test("quiz : score et corrections ; lien d'avis infalsifiable", async () => {
  const { QUIZZES, scoreQuiz } = await import("../../data/quiz-formation");
  const q = QUIZZES[0];
  const all = scoreQuiz(q, q.questions.map((x) => x.answer));
  assert.equal(all.score, all.total);
  assert.equal(scoreQuiz(q, []).score, 0);
  for (const quiz of QUIZZES) for (const x of quiz.questions) assert.ok(x.answer >= 0 && x.answer < x.choices.length, x.question);
  const { reviewToken, checkReviewToken } = await import("../review-token");
  assert.equal(checkReviewToken("cmd1", reviewToken("cmd1")), true);
  assert.equal(checkReviewToken("cmd2", reviewToken("cmd1")), false);
  assert.equal(checkReviewToken("cmd1", null), false);
});
