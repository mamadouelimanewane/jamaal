import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { metaPhone, purchasePayload } from "../meta-capi";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

test("téléphone au format Meta (indicatif 221)", () => {
  assert.equal(metaPhone("77 123 45 67"), "221771234567");
  assert.equal(metaPhone("+221 71 180 09 09"), "221711800909");
  assert.equal(metaPhone("12"), null);
});

test("achat envoyé à Meta : montant en XOF, même identifiant que le navigateur, données hachées", () => {
  const p = purchasePayload(
    { id: "ord1", total: 31_400, deliveryFee: 2_000, customerEmail: " Awa@Mail.com ", customerPhone: "77 123 45 67", customerId: null, paidAt: new Date("2026-11-21T10:00:00Z"), items: [{ productId: "p1", quantity: 2, price: 14_700 }] },
    "https://www.jamaal.sn",
  );
  assert.equal(p.event_name, "Purchase");
  assert.equal(p.event_id, "ord1");
  assert.equal(p.custom_data.currency, "XOF");
  assert.equal(p.custom_data.value, 31_400);
  assert.deepEqual(p.custom_data.content_ids, ["p1"]);
  assert.equal(p.custom_data.num_items, 2);
  assert.deepEqual(p.user_data.em, [sha("awa@mail.com")]);
  assert.deepEqual(p.user_data.ph, [sha("221771234567")]);
  assert.equal(p.event_source_url, "https://www.jamaal.sn/commande/ord1");
});
