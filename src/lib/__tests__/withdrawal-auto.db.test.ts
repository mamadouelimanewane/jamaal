/**
 * Retrait automatique vers Wave sur une vraie base (DB_TEST=1) : l'API Wave est simulée.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.DB_TEST === "1";
const T = `wa${Date.now().toString(36)}`;
type Mods = { prisma: typeof import("../prisma").prisma; w: typeof import("../wallet") };
let m: Mods;
const owner = () => ({ type: "CONSULTANT" as const, id: T });
const bal = async () => (await m.w.walletBalance(owner())).balance;
let wave: (url: string, init?: RequestInit) => { status: number; body: unknown };
const sent: { url: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;

before(async () => {
  if (!enabled) return;
  process.env.WAVE_API_KEY = "cle-test";
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.startsWith("https://api.wave.com/")) return realFetch(url, init);
    sent.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null });
    const r = wave(u, init);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  m = { prisma: (await import("../prisma")).prisma, w: await import("../wallet") };
  await m.prisma.consultant.create({ data: { id: T, name: "Retrait Auto", city: "Dakar", whatsapp: "770000001", walletProvider: "WAVE", walletNumber: "+221771112233", walletHolderName: "Retrait Auto" } });
  await m.w.adjustWallet(owner(), 30000, "Dépôt test", null);
  await m.prisma.user.create({ data: { id: `${T}-u`, email: `${T}@example.test`, name: "Retrait Auto", passwordHash: "x", role: "CONSULTANT", consultantId: T } });
});

after(async () => {
  if (!enabled) return;
  globalThis.fetch = realFetch;
  await m.prisma.notification.deleteMany({ where: { userId: `${T}-u` } });
  await m.prisma.user.delete({ where: { id: `${T}-u` } });
  await m.prisma.commissionEntry.deleteMany({ where: { consultantId: T } });
  await m.prisma.order.deleteMany({ where: { consultantId: T } });
  await m.prisma.walletTransaction.deleteMany({ where: { ownerId: T } });
  await m.prisma.consultant.delete({ where: { id: T } });
});

test("retrait versé tout de suite sur le Wave du membre, sans validation", { skip: !enabled }, async () => {
  wave = () => ({ status: 200, body: { id: "pt-ok", status: "succeeded" } });
  const t = await m.w.requestWithdrawal(owner(), 5000, null);
  assert.equal(t.status, "VALIDE");
  assert.equal(t.providerRef, "pt-ok");
  assert.deepEqual((sent.at(-1)!.body as { mobile: string; receive_amount: string }).mobile, "+221771112233");
  assert.equal(await bal(), 25000);
});

test("solde Wave Business insuffisant : en attente, puis parti tout seul à la relance", { skip: !enabled }, async () => {
  wave = () => ({ status: 400, body: { code: "insufficient-funds", message: "Insufficient balance" } });
  const t = await m.w.requestWithdrawal(owner(), 4000, null);
  assert.equal(t.status, "EN_ATTENTE");
  assert.equal(t.providerRef, null);
  assert.match(t.error ?? "", /Insufficient/);
  assert.equal(await bal(), 21000, "montant bloqué, pas perdu");
  wave = () => ({ status: 200, body: { id: "pt-late", status: "processing" } });
  const r1 = await m.w.retryPendingWithdrawals();
  assert.ok(r1.relances >= 1);
  assert.equal((await m.prisma.walletTransaction.findUniqueOrThrow({ where: { id: t.id } })).providerRef, "pt-late");
  wave = (url) => (url.endsWith("/payout/pt-late") ? { status: 200, body: { id: "pt-late", status: "succeeded" } } : { status: 500, body: {} });
  await m.w.retryPendingWithdrawals();
  const done = await m.prisma.walletTransaction.findUniqueOrThrow({ where: { id: t.id } });
  assert.equal(done.status, "VALIDE");
  assert.equal(await bal(), 21000);
});

test("numéro refusé par Wave : échec, le montant revient sur le wallet", { skip: !enabled }, async () => {
  wave = () => ({ status: 200, body: { id: "pt-ko", status: "failed", payout_error: { error_code: "recipient-not-found", reason: "No Wave account" } } });
  const t = await m.w.requestWithdrawal(owner(), 3000, null);
  assert.equal(t.status, "ECHEC");
  assert.equal(await bal(), 21000);
});

test("retrait versé : notification avec montant, produit vendu et acheteur", { skip: !enabled }, async () => {
  const o = await m.prisma.order.create({ data: { customerName: "Awa Diop", total: 26000, consultantId: T, items: { create: [{ productName: "Aqua Soul for Him", volumeLabel: "50 ml", price: 13000, quantity: 2 }] } } });
  await m.prisma.commissionEntry.create({ data: { consultantId: T, orderId: o.id, level: "VENTE", rate: 25, base: 26000, amount: 6500 } });
  await m.w.creditCommissionEntries({ consultantId: T });
  const credit = await m.prisma.notification.findFirst({ where: { userId: `${T}-u`, title: "Commission créditée" } });
  assert.match(credit?.message ?? "", /Aqua Soul for Him 50 ml ×2, acheteur Awa Diop/);
  wave = () => ({ status: 200, body: { id: "pt-n", status: "succeeded" } });
  const t = await m.w.requestWithdrawal(owner(), 6500, null);
  assert.equal(t.status, "VALIDE");
  let n = null;
  for (let i = 0; i < 30 && !n; i++) {
    await new Promise((r) => setTimeout(r, 100));
    n = await m.prisma.notification.findFirst({ where: { userId: `${T}-u`, title: { startsWith: "Retrait versé : 6" } } });
  }
  assert.ok(n, "notification de retrait");
  assert.match(n!.title, /6\s500 FCFA/);
  assert.match(n!.message, /Wave \(\+221771112233\)/);
  assert.match(n!.message, /6\s500 F · Aqua Soul for Him 50 ml ×2, acheteur Awa Diop \(commande/);
});

test("arrêt d'urgence : rien ne part, la demande attend puis repart à la reprise ; minimum 100 F", { skip: !enabled }, async () => {
  const store = await import("../business-model-store");
  const model = await store.getBusinessModel();
  await assert.rejects(() => m.w.requestWithdrawal(owner(), 99, null), /minimal/);
  await store.saveBusinessModel({ ...model, payoutsEnabled: false });
  try {
    const before = sent.length;
    wave = () => ({ status: 200, body: { id: "pt-stop", status: "succeeded" } });
    const t = await m.w.requestWithdrawal(owner(), 1000, null);
    assert.equal(t.status, "EN_ATTENTE");
    assert.equal(sent.length, before, "aucun appel Wave pendant l'arrêt");
    await store.saveBusinessModel({ ...model, payoutsEnabled: true });
    await m.w.retryPendingWithdrawals();
    assert.equal((await m.prisma.walletTransaction.findUniqueOrThrow({ where: { id: t.id } })).status, "VALIDE");
  } finally {
    await store.saveBusinessModel(model);
  }
});

test("anti-fraude : un auto-achat n'est pas crédité sur le wallet (commission en vérification)", { skip: !enabled }, async () => {
  const { runPayoutsForOrder } = await import("../payouts/engine");
  const b0 = await bal();
  const o = await m.prisma.order.create({ data: { customerName: "Retrait Auto", customerPhone: "770000001", total: 20000, consultantId: T, status: "LIVREE", paymentStatus: "PAYE", paidAt: new Date(), items: { create: [{ productName: "Test", volumeLabel: "50 ml", price: 20000, quantity: 1 }] } } });
  await runPayoutsForOrder(o.id);
  const entries = await m.prisma.commissionEntry.findMany({ where: { orderId: o.id } });
  assert.ok(entries.length > 0, "commission enregistrée");
  assert.ok(entries.every((e) => e.status === "EN_REVUE"), entries.map((e) => e.status).join(","));
  assert.equal(await bal(), b0, "rien de crédité");
  await m.prisma.fraudFlag.deleteMany({ where: { consultantId: T } });
});
