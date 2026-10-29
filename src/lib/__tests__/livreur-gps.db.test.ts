/**
 * Géolocalisation des livraisons sur une vraie base : trace, alerte « arrive », preuve de remise, tournée.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.DB_TEST === "1";
const T = `g${Date.now().toString(36)}`;
const DEST = { lat: 14.7167, lng: -17.4677 };
const near = (m: number) => ({ lat: DEST.lat + m / 111_320, lng: DEST.lng });

type Mods = { prisma: typeof import("../prisma").prisma; track: typeof import("../livreur-tracking"); engine: typeof import("../delivery-engine"); tour: typeof import("../tour/tour") };
let m: Mods;

before(async () => {
  if (!enabled) return;
  m = { prisma: (await import("../prisma")).prisma, track: await import("../livreur-tracking"), engine: await import("../delivery-engine"), tour: await import("../tour/tour") };
  await m.prisma.livreur.create({ data: { id: `${T}-l`, name: "Livreur GPS", phone: "221770000999" } });
  for (const [id, st, lat] of [["a", "EN_ROUTE", DEST.lat], ["b", "RECUPEREE", DEST.lat + 0.02]] as const)
    await m.prisma.order.create({ data: { id: `${T}-${id}`, customerName: `Client ${id}`, total: 1000, deliveryMode: "LIVRAISON_JAMAAL", deliveryStatus: st, livreurId: `${T}-l`, deliveryLat: lat, deliveryLng: DEST.lng, deliveryCode: "1234" } });
});
after(async () => {
  if (!enabled) return;
  await m.prisma.order.deleteMany({ where: { id: { startsWith: T } } });
  await m.prisma.livreur.deleteMany({ where: { id: { startsWith: T } } });
});

test("trace GPS, alerte d'arrivée unique, preuve de remise et tournée", { skip: !enabled }, async () => {
  const L = `${T}-l`;
  const r1 = await m.track.recordPosition(L, { ...near(2000), accuracy: 10 });
  assert.equal(r1.saved, true);
  assert.equal(r1.arriving, 0);
  const r2 = await m.track.recordPosition(L, near(1900));
  assert.equal(r2.saved, false, "moins de 4 s : position mise à jour sans nouveau point de trace");
  const liv = await m.prisma.livreur.findUniqueOrThrow({ where: { id: L } });
  assert.ok(Math.abs(liv.lastLat! - near(1900).lat) < 1e-9);

  await m.prisma.livreurPing.updateMany({ where: { livreurId: L }, data: { createdAt: new Date(Date.now() - 60_000) } });
  const r3 = await m.track.recordPosition(L, near(150));
  assert.equal(r3.arriving, 1, "client prévenu à 150 m");
  await m.prisma.livreurPing.updateMany({ where: { livreurId: L }, data: { createdAt: new Date(Date.now() - 60_000) } });
  const r4 = await m.track.recordPosition(L, near(50));
  assert.equal(r4.arriving, 0, "une seule fois");

  const tour = await m.tour.livreurTour(L, { withRoute: false });
  assert.deepEqual(tour.stops.map((s) => s.id), [`${T}-a`, `${T}-b`]);
  assert.equal(tour.live, true);

  await m.engine.advanceDelivery(`${T}-a`, "LIVREE", { kind: "livreur", livreurId: L }, { ...near(40), code: "1234" });
  const o = await m.prisma.order.findUniqueOrThrow({ where: { id: `${T}-a` } });
  assert.equal(o.deliveryStatus, "LIVREE");
  assert.ok(o.deliveredDistanceM! >= 38 && o.deliveredDistanceM! <= 42);
  assert.ok((await m.prisma.livreurPing.count({ where: { livreurId: L } })) >= 3);
});
