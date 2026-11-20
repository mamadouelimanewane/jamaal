import { test } from "node:test";
import assert from "node:assert/strict";
import { inSegment, renderOutreach, type OutreachRow } from "../reseller-outreach";

const row = (o: Partial<OutreachRow>): OutreachRow => ({ id: "x", name: "Awa Dieng", slug: "awa", ready: true, visitors: 0, whatsappClicks: 0, sales: 0, salesAmount: 0, lastActivity: null, ...o });
const rows = [row({ id: "a" }), row({ id: "b", visitors: 30 }), row({ id: "c", visitors: 5, sales: 2, salesAmount: 40_000 }), row({ id: "d", ready: false, slug: null })];

test("groupes de revendeurs selon leur activité", () => {
  assert.deepEqual(inSegment(rows, "inactifs").map((r) => r.id), ["a", "d"]);
  assert.deepEqual(inSegment(rows, "sans-vente").map((r) => r.id), ["b"]);
  assert.deepEqual(inSegment(rows, "actifs").map((r) => r.id), ["c"]);
  assert.deepEqual(inSegment(rows, "a-completer").map((r) => r.id), ["d"]);
  assert.deepEqual(inSegment(rows, "top").map((r) => r.id), ["c"]);
});

test("variables remplacées pour chaque revendeur", () => {
  const t = renderOutreach("Bonjour {prenom} : {ventes} vente(s), {ca} en {jours} jours. {boutique}", rows[2], 30, "https://www.jamaal.sn");
  assert.equal(t.replace(/[\u202f\u00a0]/g, " "), "Bonjour Awa : 2 vente(s), 40 000 F en 30 jours. https://www.jamaal.sn/c/awa");
});
