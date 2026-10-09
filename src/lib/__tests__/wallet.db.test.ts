/**
 * Wallet des membres sur une vraie base (npm run test:db).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.DB_TEST === "1";
const T = `wl${Date.now().toString(36)}`;
type Mods = { prisma: typeof import("../prisma").prisma; w: typeof import("../wallet") };
let m: Mods;
const owner = () => ({ type: "CONSULTANT" as const, id: T });
const bal = async () => (await m.w.walletBalance(owner())).balance;

before(async () => {
  if (!enabled) return;
  m = { prisma: (await import("../prisma")).prisma, w: await import("../wallet") };
  await m.prisma.consultant.create({ data: { id: T, name: "Wallet Test", city: "Dakar", whatsapp: "770000000", walletProvider: "WAVE", walletNumber: "+221771234567", walletHolderName: "Wallet Test" } });
  await m.prisma.commissionEntry.createMany({ data: [
    { consultantId: T, orderId: `${T}-o1`, level: "VENTE", rate: 18, base: 50000, amount: 9000 },
    { consultantId: T, orderId: `${T}-o2`, level: "NIVEAU_1", rate: 3, base: 100000, amount: 3000 },
  ] });
});

after(async () => {
  if (!enabled) return;
  await m.prisma.walletTransaction.deleteMany({ where: { ownerId: T } });
  await m.prisma.commissionEntry.deleteMany({ where: { consultantId: T } });
  await m.prisma.consultant.delete({ where: { id: T } });
});

test("commissions créditées une seule fois", { skip: !enabled }, async () => {
  await m.w.creditCommissionEntries({ consultantId: T });
  await m.w.creditCommissionEntries({ consultantId: T });
  assert.equal(await bal(), 12000);
  assert.equal(await m.prisma.commissionEntry.count({ where: { consultantId: T, status: "WALLET" } }), 2);
});

test("retrait : montant bloqué, solde insuffisant refusé, refus = remboursé", { skip: !enabled }, async () => {
  await assert.rejects(() => m.w.requestWithdrawal(owner(), 50000, null), /Solde insuffisant/);
  await assert.rejects(() => m.w.requestWithdrawal(owner(), 100, null), /minimal/);
  const t = await m.w.requestWithdrawal(owner(), 5000, null);
  assert.equal(t.status, "EN_ATTENTE"); // pas de clés de versement en test
  assert.equal(await bal(), 7000);
  await m.w.resolveWithdrawal(t.id, false, null, "test");
  assert.equal(await bal(), 12000);
  const t2 = await m.w.requestWithdrawal(owner(), 2000, null);
  await m.w.resolveWithdrawal(t2.id, true, null, "REF1");
  assert.equal(await bal(), 10000);
  await assert.rejects(() => m.w.resolveWithdrawal(t2.id, true, null), /plus en attente/);
});

test("dépôt validé par le prestataire (montant contrôlé)", { skip: !enabled }, async () => {
  const d = await m.w.createDeposit(owner(), 5000, "WAVE", null);
  assert.equal(await bal(), 10000);
  assert.equal(await m.w.markDepositPaid(d.id, { amount: 4000 }), false);
  assert.equal(await m.w.markDepositPaid(d.id, { amount: 5000, externalRef: "W1" }), true);
  assert.equal(await m.w.markDepositPaid(d.id, { amount: 5000 }), true);
  assert.equal(await bal(), 15000);
});

test("paiement d'une commande et annulation des gains", { skip: !enabled }, async () => {
  await m.prisma.$transaction((tx) => m.w.debitForOrder(tx, owner(), `${T}-o9`, 4000, null));
  assert.equal(await bal(), 11000);
  await assert.rejects(() => m.prisma.$transaction((tx) => m.w.debitForOrder(tx, owner(), `${T}-o10`, 999999, null)), /insuffisant/);
  await m.w.reverseWalletCreditsForOrder(`${T}-o1`);
  await m.w.reverseWalletCreditsForOrder(`${T}-o1`);
  assert.equal(await bal(), 2000);
});
