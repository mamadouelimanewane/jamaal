import { test } from "node:test";
import assert from "node:assert/strict";
import type { OrderItemDetail } from "../../components/admin/OrderDetailCell";

test("OrderDetailCell – article complet avec infos produit", () => {
  const item: OrderItemDetail = {
    productName: "Extrait de Parfum N°024",
    volumeLabel: "100 ml",
    price: 14800,
    quantity: 2,
    product: {
      choganCode: "024",
      name: "Extrait de Parfum N°024",
      inspiredBy: "Black Opium",
      inspiredBrand: "Yves Saint Laurent",
    },
  };

  assert.equal(item.product?.choganCode, "024");
  assert.equal(item.productName, "Extrait de Parfum N°024");
  assert.equal(item.product?.inspiredBy, "Black Opium");
  assert.equal(item.product?.inspiredBrand, "Yves Saint Laurent");
  assert.equal(item.volumeLabel, "100 ml");
  assert.equal(item.price, 14800);
  assert.equal(item.quantity, 2);
});

test("OrderDetailCell – article sans infos produit (fallback)", () => {
  const item: OrderItemDetail = {
    productName: "Parfum Anonyme",
    volumeLabel: "50 ml",
    price: 9500,
    quantity: 1,
  };

  assert.equal(item.product, undefined);
  assert.equal(item.productName, "Parfum Anonyme");
  assert.equal(item.price, 9500);
  assert.equal(item.quantity, 1);
});
