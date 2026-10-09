/**
 * Moteur de stock sur une vraie base (npm run test:db avec DATABASE_URL d'une base de test).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.DB_TEST === "1";
const T = `t${Date.now().toString(36)}`;
const P = `${T}-parfum`;
const U = `${T}-gel`;

type Mods = {
  prisma: typeof import("../prisma").prisma;
  stock: typeof import("../stock");
  report: typeof import("../inventory-report");
};
let m: Mods;

async function variant(label: string) {
  return m.prisma.productVariant.findUniqueOrThrow({ where: { productId_volumeLabel: { productId: P, volumeLabel: label } } });
}
async function newOrder(items: { productId: string; volumeLabel: string; quantity: number }[]) {
  return m.prisma.order.create({ data: { customerName: "Test", total: 1, items: { create: items.map((i) => ({ ...i, productName: "x", price: 1 })) } } });
}
async function reserve(orderId: string, items: { productId: string; volumeLabel: string; quantity: number }[], strict = true) {
  return m.prisma.$transaction((tx) => m.stock.reserveStock(tx, items, strict, { orderId }));
}

before(async () => {
  if (!enabled) return;
  m = { prisma: (await import("../prisma")).prisma, stock: await import("../stock"), report: await import("../inventory-report") };
  await m.prisma.product.create({
    data: {
      id: P, slug: P, name: "Parfum test", category: "parfum-homme", shortDescription: "t", longDescription: [], choganCode: `${T}M`.toUpperCase(), number: 990001,
      stock: 0, volumes: [{ label: "70 ml", price: 28700 }, { label: "30 ml", price: 14800 }],
      variants: { create: [{ id: `${P}-0`, volumeLabel: "70 ml", code: `${T}M`.toUpperCase(), stock: 5, lowStockThreshold: 2 }, { id: `${P}-1`, volumeLabel: "30 ml", code: `3${T}M`.toUpperCase(), stock: 1, lowStockThreshold: 1 }] },
    },
  });
  await m.prisma.product.create({ data: { id: U, slug: U, name: "Gel test", category: "gels-douche", shortDescription: "t", longDescription: [], stock: 3, lowStockThreshold: 1, number: 990002 } });
});

after(async () => {
  if (!enabled) return;
  await m.prisma.order.deleteMany({ where: { customerName: "Test", items: { some: { productId: { in: [P, U] } } } } });
  await m.prisma.product.deleteMany({ where: { id: { in: [P, U] } } });
  await m.prisma.$disconnect();
});

const opts = { skip: !enabled && "DB_TEST non défini" };

test("vente : retire le bon format, trace le mouvement, marque la commande", opts, async () => {
  const items = [{ productId: P, volumeLabel: "70 ml", quantity: 2 }];
  const o = await newOrder(items);
  await reserve(o.id, items);
  assert.equal((await variant("70 ml")).stock, 3);
  assert.equal((await variant("30 ml")).stock, 1, "les autres formats ne bougent pas");
  const mv = await m.prisma.stockMovement.findFirstOrThrow({ where: { orderId: o.id } });
  assert.equal(mv.kind, "VENTE");
  assert.equal(mv.delta, -2);
  assert.equal(mv.previousStock, 5);
  assert.equal(mv.nextStock, 3);
  assert.equal((await m.prisma.order.findUniqueOrThrow({ where: { id: o.id } })).stockState, "RESERVE");
});

test("stock insuffisant : la commande est refusée et rien ne bouge", opts, async () => {
  const items = [{ productId: P, volumeLabel: "70 ml", quantity: 1 }, { productId: P, volumeLabel: "30 ml", quantity: 2 }];
  const o = await newOrder(items);
  await assert.rejects(reserve(o.id, items), /stock insuffisant/i);
  assert.equal((await variant("70 ml")).stock, 3, "retrait du 70 ml annulé (transaction)");
  assert.equal((await variant("30 ml")).stock, 1);
});

test("dernière unité disputée par deux commandes simultanées : une seule passe", opts, async () => {
  const items = [{ productId: P, volumeLabel: "30 ml", quantity: 1 }];
  const [a, b] = await Promise.all([newOrder(items), newOrder(items)]);
  const results = await Promise.allSettled([reserve(a.id, items), reserve(b.id, items)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await variant("30 ml")).stock, 0);
});

test("annulation : remise en stock une seule fois, puis reprise si la commande revient", opts, async () => {
  const items = [{ productId: P, volumeLabel: "70 ml", quantity: 2 }];
  const o = await newOrder(items);
  await reserve(o.id, items);
  assert.equal((await variant("70 ml")).stock, 1);
  await m.prisma.order.update({ where: { id: o.id }, data: { status: "ANNULEE" } });
  await m.stock.syncOrderStock(o.id);
  await m.stock.syncOrderStock(o.id);
  assert.equal((await variant("70 ml")).stock, 3, "remis une seule fois");
  await m.prisma.order.update({ where: { id: o.id }, data: { status: "CONFIRMEE" } });
  await m.stock.syncOrderStock(o.id);
  await m.stock.syncOrderStock(o.id);
  assert.equal((await variant("70 ml")).stock, 1, "repris une seule fois");
  const kinds = (await m.prisma.stockMovement.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } })).map((x) => `${x.kind}:${x.delta}`);
  assert.deepEqual(kinds, ["VENTE:-2", "ANNULATION:2", "VENTE:-2"]);
});

test("commande ancienne (avant le suivi) annulée : remise en stock une fois", opts, async () => {
  const o = await newOrder([{ productId: U, volumeLabel: "Format unique", quantity: 1 }]);
  await m.prisma.order.update({ where: { id: o.id }, data: { status: "ANNULEE" } });
  await m.stock.syncOrderStock(o.id);
  await m.stock.syncOrderStock(o.id);
  assert.equal((await m.prisma.product.findUniqueOrThrow({ where: { id: U } })).stock, 4);
});

test("ancien panier « Format unique » rattaché au format principal", opts, async () => {
  const ref = await m.prisma.$transaction((tx) => m.stock.resolveStockRef(tx, P, "Format unique"));
  assert.equal(ref?.variantId, `${P}-0`);
  assert.equal(ref?.label, "70 ml");
});

test("vente déjà conclue (vendeur) au-delà du stock : stock à 0 et écart noté", opts, async () => {
  const items = [{ productId: U, volumeLabel: "Format unique", quantity: 9 }];
  const o = await newOrder(items);
  await reserve(o.id, items, false);
  assert.equal((await m.prisma.product.findUniqueOrThrow({ where: { id: U } })).stock, 0);
  const mv = await m.prisma.stockMovement.findFirstOrThrow({ where: { orderId: o.id } });
  assert.equal(mv.delta, -4);
  assert.match(mv.reason, /il manquait 5/);
});

test("inventaire : fixe le stock compté et trace l'écart", opts, async () => {
  const ref = { productId: P, variantId: `${P}-1`, label: "30 ml" };
  const r = await m.prisma.$transaction((tx) => m.stock.setStock(tx, ref, 7, { reason: "Inventaire test", reference: "INV-1" }));
  assert.equal(r.previousStock, 0);
  assert.equal((await variant("30 ml")).stock, 7);
  const mv = await m.prisma.stockMovement.findFirstOrThrow({ where: { variantId: `${P}-1`, kind: "INVENTAIRE" } });
  assert.equal(mv.delta, 7);
  assert.equal(mv.reference, "INV-1");
});

test("réception par code de format, code produit ou n° de fiche", opts, async () => {
  assert.equal((await m.report.findByCode(`3${T}M`))?.variantId, `${P}-1`);
  assert.equal((await m.report.findByCode(`${T}m`))?.variantId, `${P}-0`, "code produit → format principal");
  assert.equal((await m.report.findByCode("990002"))?.productId, U);
  assert.equal(await m.report.findByCode("ZZZ-INCONNU"), null);
});

test("tableau des stocks : une ligne par format avec ventes et état", opts, async () => {
  const rows = (await m.report.getStockRows()).filter((r) => r.productId === P);
  assert.deepEqual(rows.map((r) => r.format).sort(), ["30 ml", "70 ml"]);
  const r70 = rows.find((r) => r.format === "70 ml")!;
  assert.equal(r70.sold30, 4, "2 + 2 vendus, l'annulation compensée");
  assert.equal(r70.status, "bas");
});
