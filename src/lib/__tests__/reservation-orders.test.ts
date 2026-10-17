import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateReserved, type RawReservedItem } from "../reservation-orders";

const item = (o: Partial<RawReservedItem>): RawReservedItem => ({
  orderId: "o1",
  customerName: "Awa",
  customerPhone: "+221770000000",
  paidAt: new Date("2026-10-17T10:00:00Z"),
  productId: "p1",
  variantId: null,
  productName: "Parfum A",
  volumeLabel: "30 ml",
  quantity: 1,
  code: "001M",
  ...o,
});

test("réservations regroupées par produit et format, quantités additionnées", () => {
  const lines = aggregateReserved([
    item({ orderId: "o1", quantity: 2 }),
    item({ orderId: "o2", customerName: "Moussa", quantity: 1 }),
    item({ orderId: "o3", productId: "p2", productName: "Parfum B", code: "060", quantity: 5 }),
    item({ orderId: "o4", volumeLabel: "70 ml", quantity: 1 }),
  ]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((l) => [l.name, l.format, l.quantity]), [["Parfum B", "30 ml", 5], ["Parfum A", "30 ml", 3], ["Parfum A", "70 ml", 1]]);
  const a = lines.find((l) => l.name === "Parfum A" && l.format === "30 ml")!;
  assert.deepEqual(a.customers.map((c) => [c.name, c.quantity]), [["Awa", 2], ["Moussa", 1]]);
});

test("un même client qui réserve deux fois le même produit n'apparaît qu'une fois, quantités additionnées", () => {
  const lines = aggregateReserved([item({ quantity: 1 }), item({ quantity: 2 })]);
  assert.equal(lines[0].quantity, 3);
  assert.equal(lines[0].customers.length, 1);
  assert.equal(lines[0].customers[0].quantity, 3);
});

test("quantités nulles ignorées ; liste vide = compteur à zéro", () => {
  assert.deepEqual(aggregateReserved([item({ quantity: 0 })]), []);
  assert.deepEqual(aggregateReserved([]), []);
});
