import { test } from "node:test";
import assert from "node:assert/strict";
import { alertsByManager, computeHealth, leaderOf, managerAlertText, type Member, type MemberSales } from "../health/network-health";

const now = new Date("2026-10-23T10:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
const M = (id: string, sponsorId: string | null, joined: number): Member => ({ id, name: `Membre ${id.toUpperCase()}`, city: "Dakar", whatsapp: "770000000", sponsorId, createdAt: ago(joined) });
// L (Leader) → P (Parrain) → C1, C2 ; L → C3
const members = [M("l", null, 400), M("p", "l", 200), M("c1", "p", 60), M("c2", "p", 40), M("c3", "l", 25)];
const sales = new Map<string, MemberSales>([
  ["l", { lastSaleAt: ago(2), firstSaleAt: ago(390), sales30: 8, revenue30: 160_000 }],
  ["p", { lastSaleAt: ago(30), firstSaleAt: ago(190), sales30: 0, revenue30: 0 }],
  ["c1", { lastSaleAt: ago(3), firstSaleAt: ago(50), sales30: 4, revenue30: 80_000 }],
]);

test("décrocheurs : plus de vente depuis 21 jours, ou jamais vendu après 21 jours", () => {
  const h = computeHealth(members, sales, now);
  assert.deepEqual(h.droppers.map((d) => [d.m.id, d.idle, d.neverSold]), [["p", 30, false], ["c3", 25, true], ["c2", 40, true]]);
  assert.equal(h.droppers.find((d) => d.m.id === "c2")!.leader?.id, "l");
  assert.equal(h.droppers.find((d) => d.m.id === "c2")!.sponsor?.id, "p");
  assert.equal(h.totals.active30, 2);
});

test("meilleurs parrains et taux d'activation des nouveaux", () => {
  const h = computeHealth(members, sales, now);
  assert.equal(h.topSponsors[0].m.id, "p");
  assert.equal(h.topSponsors[0].teamRevenue, 80_000);
  assert.equal(h.topSponsors[0].active, 1);
  // Cohorte (30 à 180 jours) : c1 (1re vente à J+10 : activé), c2 (jamais) → 50 %
  assert.equal(h.activation.joined, 2);
  assert.equal(h.activation.rate, 0.5);
});

test("alertes : le Leader voit toute son équipe, le parrain direct la sienne", () => {
  const h = computeHealth(members, sales, now);
  const a = alertsByManager(h.droppers);
  assert.deepEqual(a.find((x) => x.manager.id === "l")!.items.map((d) => d.m.id).sort(), ["c2", "c3", "p"]);
  assert.deepEqual(a.find((x) => x.manager.id === "p")!.items.map((d) => d.m.id), ["c2"]);
  const t = managerAlertText("Leader Diop", a.find((x) => x.manager.id === "l")!.items, "https://www.jamaal.sn", true);
  assert.match(t, /^👋 Leader, 3 membres de votre équipe ont besoin/);
  assert.match(t, /Membre C2 \(Dakar\) : pas encore de vente, inscrit·e il y a 40 j · parrain Membre/);
  assert.equal(leaderOf("l", new Map(members.map((m) => [m.id, m]))), null);
});
