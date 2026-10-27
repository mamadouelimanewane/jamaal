import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderDetailCell, type OrderItemDetail } from "../../components/admin/OrderDetailCell";

test("OrderDetailCell : structure de données d'un article de commande", () => {
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
  assert.equal(item.volumeLabel, "100 ml");
  assert.equal(item.price, 14800);
  assert.equal(item.quantity, 2);
  assert.ok(typeof OrderDetailCell === "function");
});
