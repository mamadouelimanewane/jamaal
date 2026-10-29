import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLivreurSignup, livreurDecisionMessage, waLink } from "../livreur-signup";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  const base = { name: "Ibrahima Ndiaye", phone: "77 123 45 67", password: "motdepasse1", confirm: "motdepasse1", zone: "Plateau, Médina", vehicle: "MOTO", walletProvider: "WAVE", walletNumber: "", charte: "on" };
  for (const [k, v] of Object.entries({ ...base, ...o })) if (v !== "__none__") f.set(k, v);
  return f;
};

test("inscription livreur valide : numéro canonique, wallet = WhatsApp par défaut", () => {
  const r = parseLivreurSignup(form({}));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.data.phone, "221771234567");
  assert.equal(r.data.walletNumber, "221771234567");
  assert.equal(r.data.vehicle, "MOTO");
  assert.equal(r.data.idNumber, null);
});

test("inscription livreur : erreurs par champ", () => {
  const cases: [Record<string, string>, string][] = [
    [{ name: "Ibou" }, "name"],
    [{ phone: "12345" }, "phone"],
    [{ phone: "33 822 00 00" }, "phone"],
    [{ password: "court1", confirm: "court1" }, "password"],
    [{ password: "sanschiffre", confirm: "sanschiffre" }, "password"],
    [{ confirm: "autre12345" }, "confirm"],
    [{ zone: "" }, "zone"],
    [{ vehicle: "AVION" }, "vehicle"],
    [{ walletNumber: "123" }, "walletNumber"],
    [{ charte: "__none__" }, "charte"],
  ];
  for (const [o, field] of cases) {
    const r = parseLivreurSignup(form(o));
    assert.equal(r.ok, false, JSON.stringify(o));
    if (!r.ok) assert.equal(r.field, field, JSON.stringify(o));
  }
});

test("wallet Orange Money avec numéro distinct", () => {
  const r = parseLivreurSignup(form({ walletProvider: "ORANGE_MONEY", walletNumber: "+221 78 000 11 22", idNumber: "1 234 5678" }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.walletProvider, "ORANGE_MONEY");
    assert.equal(r.data.walletNumber, "221780001122");
    assert.equal(r.data.idNumber, "1 234 5678");
  }
});

test("messages de décision et lien wa.me", () => {
  assert.match(livreurDecisionMessage("Awa Diop", true, "https://www.jamaal.sn/livreur"), /^Bonjour Awa, .*validée.*jamaal\.sn\/livreur/);
  assert.match(livreurDecisionMessage("Awa Diop", false, ""), /ne pouvons pas/);
  assert.equal(waLink("+221 77 123 45 67", "a b"), "https://wa.me/221771234567?text=a%20b");
});
