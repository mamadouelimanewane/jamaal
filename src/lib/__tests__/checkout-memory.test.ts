import { test } from "node:test";
import assert from "node:assert/strict";
import { forgetCheckoutMemory, loadCheckoutMemory, saveCheckoutMemory } from "../checkout-memory";

function fakeStorage() {
  const data = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) },
  };
}

test("première commande : l'identité est mémorisée, puis relue", () => {
  fakeStorage();
  assert.equal(loadCheckoutMemory(), null);
  saveCheckoutMemory({ name: " Awa Diop ", phone: "77 123 45 67" });
  assert.deepEqual(loadCheckoutMemory(), { name: "Awa Diop", phone: "77 123 45 67" });
});

test("commande pour quelqu'un d'autre : l'identité mémorisée n'est pas remplacée", () => {
  fakeStorage();
  saveCheckoutMemory({ name: "Awa Diop", phone: "77 123 45 67" });
  saveCheckoutMemory({ name: "Moussa Ndiaye", phone: "78 999 88 77" });
  assert.deepEqual(loadCheckoutMemory(), { name: "Awa Diop", phone: "77 123 45 67" });
});

test("même numéro écrit autrement : le nom est mis à jour", () => {
  fakeStorage();
  saveCheckoutMemory({ name: "Awa", phone: "77 123 45 67" });
  saveCheckoutMemory({ name: "Awa Diop", phone: "+221771234567" });
  assert.equal(loadCheckoutMemory()?.name, "Awa Diop");
});

test("« Effacer » oublie l'identité : la suivante est mémorisée", () => {
  fakeStorage();
  saveCheckoutMemory({ name: "Awa Diop", phone: "77 123 45 67" });
  forgetCheckoutMemory();
  assert.equal(loadCheckoutMemory(), null);
  saveCheckoutMemory({ name: "Moussa", phone: "78 999 88 77" });
  assert.equal(loadCheckoutMemory()?.name, "Moussa");
});
