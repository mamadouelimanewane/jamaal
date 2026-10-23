import { test } from "node:test";
import assert from "node:assert/strict";
import { actionLink, buildCopilotPlan, copilotWhatsAppText, type CopilotInput } from "../copilot/plan";

const now = new Date("2026-10-23T08:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
const base = (o: Partial<CopilotInput> = {}): CopilotInput => ({
  consultant: { name: "Fatou Sow", slug: "fatou" }, origin: "https://www.jamaal.sn", now,
  orders: [], birthdays: [], carts: [], filleuls: [], product: { name: "Aqua Soul", slug: "aqua-soul" }, done: new Set(), optedOut: new Set(), ...o,
});

test("5 actions dans l'ordre : anniversaire, panier, relances, filleul", () => {
  const plan = buildCopilotPlan(base({
    birthdays: [{ phone: "771111111", name: "Awa Diop" }],
    carts: [{ id: "c1", phone: "772222222", name: "Moussa", total: 24_500, products: ["Aqua Soul"], updatedAt: ago(1) }],
    orders: [
      { id: "o1", phone: "773333333", name: "Aminata", createdAt: ago(40), products: ["Rebel Icon"], productSlug: "rebel" },
      { id: "o2", phone: "774444444", name: "Khady", createdAt: ago(50), products: ["Gel douche"], productSlug: null },
      { id: "o3", phone: "775555555", name: "Ndeye", createdAt: ago(60), products: ["Her Secret"], productSlug: null },
      { id: "o4", phone: "776666666", name: "Trop tôt", createdAt: ago(10), products: ["X"], productSlug: null },
    ],
    filleuls: [{ id: "f1", name: "Ibou", whatsapp: "777777777", joinedAt: ago(30), lastSaleAt: null, sales: 0 }],
  }));
  assert.deepEqual(plan.map((a) => a.type), ["anniversaire", "panier", "relance", "relance", "filleul"]);
  const r = plan[2];
  assert.equal(r.title, "🔁 Relancer Aminata");
  assert.match(r.detail, /il y a 40 jours/);
  assert.match(r.message, /^Bonjour Aminata 🌸, c'est Fatou de JAMAAL/);
  assert.match(r.message, /\/produits\/rebel\?ref=fatou/);
  assert.equal(r.phone, "221773333333");
  assert.match(actionLink(r), /^https:\/\/wa\.me\/221773333333\?text=Bonjour/);
});

test("pas de doublon, STOP respecté, actions déjà proposées ignorées, statut en complément", () => {
  const plan = buildCopilotPlan(base({
    orders: [
      { id: "o1", phone: "+221 77 333 33 33", name: "Aminata", createdAt: ago(40), products: ["A"], productSlug: null },
      { id: "o0", phone: "773333333", name: "Aminata", createdAt: ago(70), products: ["B"], productSlug: null },
      { id: "o2", phone: "774444444", name: "Khady", createdAt: ago(45), products: ["C"], productSlug: null },
      { id: "o3", phone: "775555555", name: "Stop", createdAt: ago(45), products: ["D"], productSlug: null },
    ],
    done: new Set(["relance:o2"]),
    optedOut: new Set(["775555555"]),
  }));
  assert.deepEqual(plan.map((a) => a.type), ["relance", "statut"]);
  assert.match(plan[1].message, /aqua-soul\?ref=fatou/);
  assert.match(copilotWhatsAppText("Fatou Sow", plan), /^☀️ Bonjour Fatou ! Vos 2 actions du jour :\n1\. 🔁 Relancer Aminata\n2\. 📣/);
});

test("filleul actif récemment : rien à proposer", () => {
  const plan = buildCopilotPlan(base({ product: null, filleuls: [{ id: "f1", name: "Ibou", whatsapp: "777777777", joinedAt: ago(90), lastSaleAt: ago(3), sales: 4 }] }));
  assert.equal(plan.length, 0);
});
