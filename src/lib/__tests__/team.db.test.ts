/**
 * Équipes et rangs sur une vraie base (npm run test:db).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.DB_TEST === "1";
const T = `tm${Date.now().toString(36)}`;
type Mods = { prisma: typeof import("../prisma").prisma; team: typeof import("../team"); network: typeof import("../network"); bm: typeof import("../business-model") };
let m: Mods;
const id = (s: string) => `${T}-${s.toLowerCase()}`;
const limits = { maxParrainsPerLeader: 2, maxConsultantsPerParrain: 2 };

async function member(key: string, sponsor: string | null, rank: string | null = null) {
  return m.prisma.consultant.create({ data: { id: id(key), name: key, city: "Dakar", whatsapp: "770000000", slug: id(key), sponsorId: sponsor ? id(sponsor) : null, rank } });
}
const title = (k: string) => m.network.getMemberTitle(id(k));
const sponsorOf = async (k: string) => (await m.prisma.consultant.findUnique({ where: { id: id(k) }, select: { sponsorId: true } }))?.sponsorId ?? null;

before(async () => {
  if (!enabled) return;
  m = { prisma: (await import("../prisma")).prisma, team: await import("../team"), network: await import("../network"), bm: await import("../business-model") };
  // L (Leader) → P (Parrain) → C1, C2 (Consultants) ; L2 Leader seul
  await member("L", null);
  await member("P", "L");
  await member("C1", "P");
  await member("C2", "P");
  await member("L2", null);
});

after(async () => {
  if (!enabled) return;
  await m.prisma.commissionEntry.deleteMany({ where: { consultantId: { startsWith: T } } });
  await m.prisma.order.deleteMany({ where: { consultantId: { startsWith: T } } });
  await m.prisma.consultant.updateMany({ where: { id: { startsWith: T } }, data: { sponsorId: null } });
  await m.prisma.consultant.deleteMany({ where: { id: { startsWith: T } } });
});

test("titres déduits de la chaîne", { skip: !enabled }, async () => {
  assert.deepEqual([await title("L"), await title("P"), await title("C1")], ["Leader", "Parrain", "Consultant"]);
});

test("limite de 2 Consultants par Parrain (réglage du test)", { skip: !enabled }, async () => {
  const cap = await m.network.sponsorCapacity(id("P"), limits);
  assert.equal(cap.ok, false);
  assert.equal(cap.title, "Parrain");
  assert.equal((await m.network.sponsorCapacity(id("C1"), limits)).finalSeller, true);
});

test("retirer un membre : il devient libre et garde son rang", { skip: !enabled }, async () => {
  await m.team.removeFromTeam(id("P"), id("C2"));
  assert.equal(await sponsorOf("C2"), null);
  assert.equal(await title("C2"), "Consultant");
  await assert.rejects(() => m.team.removeFromTeam(id("P"), id("C2")), /ne fait pas partie/);
});

test("ajouter un membre libre par son code", { skip: !enabled }, async () => {
  await assert.rejects(() => m.team.addToTeam(id("P"), id("L2"), limits), /Leader/);
  await m.team.addToTeam(id("L2"), id("C2"), limits);
  assert.equal(await sponsorOf("C2"), id("L2"));
  assert.equal(await title("C2"), "Parrain"); // rejoint un Leader → Parrain
  await assert.rejects(() => m.team.addToTeam(id("L2"), id("C2"), limits), /déjà partie de votre équipe/);
  await assert.rejects(() => m.team.addToTeam(id("P"), id("C1"), limits), /déjà partie de votre équipe/);
});

test("promotions : Parrain → Leader garde son équipe, Consultant → Parrain remonte sous le Leader", { skip: !enabled }, async () => {
  await assert.rejects(() => m.team.setMemberRank(id("P"), "CONSULTANT", limits), /membre\(s\) dans son équipe/);
  await m.team.setMemberRank(id("C1"), "PARRAIN", limits);
  assert.equal(await sponsorOf("C1"), id("L"));
  assert.equal(await title("C1"), "Parrain");
  await m.team.setMemberRank(id("P"), "LEADER", limits);
  assert.equal(await sponsorOf("P"), null);
  assert.equal(await title("P"), "Leader");
  assert.equal(await title("L"), "Leader");
});

test("prime d'équipe du mois : CA de l'équipe et palier", { skip: !enabled }, async () => {
  // L2 a C2 (Parrain) : vente encaissée de C2 ce mois-ci
  const now = new Date();
  await m.prisma.order.create({ data: { customerName: "x", total: 1_250_000, deliveryFee: 0, consultantId: id("C2"), paymentStatus: "PAYE", status: "LIVREE", createdAt: now } });
  const model = { ...m.bm.DEFAULT_BUSINESS_MODEL };
  const rows = await m.team.computeTeamPrimes(m.team.monthKey(now), model);
  const r = rows.find((x) => x.consultantId === id("L2"));
  assert.ok(r);
  assert.equal(r.teamSales, 1_250_000);
  assert.equal(r.amount, 15_000);
});
