import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMarkdown } from "../../components/ChatMarkdown";

const html = (text: string) => renderToStaticMarkup(<ChatMarkdown text={text} linkClassName="l" />);

test("un lien dans du gras reste cliquable", () => {
  const out = html("* **[Aqua Soul for Him](/produits/aqua-soul)** (Inspiré de *Light Blue*) : 28 700 FCFA");
  assert.match(out, /<strong><a class="l" href="\/produits\/aqua-soul">Aqua Soul for Him<\/a><\/strong>/);
  assert.match(out, /<em>Light Blue<\/em>/);
  assert.match(out, /<li>/);
  assert.ok(!out.includes("**"));
});

test("liens externes et chemins doubles ne deviennent pas des liens", () => {
  const out = html("[site](https://exemple.com) et [x](//pirate.com)");
  assert.ok(!out.includes("<a"));
  assert.match(out, /site et x/);
});

test("le texte est échappé", () => {
  assert.match(html("<script>alert(1)</script>"), /&lt;script&gt;/);
});

test("liens externes : WhatsApp et le site cliquables, les autres restent du texte", async () => {
  const { isSafeExternal } = await import("../../components/ChatMarkdown");
  assert.equal(isSafeExternal("https://wa.me/221771234567?text=x"), true);
  assert.equal(isSafeExternal("https://jamaal.sn/c/awa", "jamaal.sn"), true);
  assert.equal(isSafeExternal("https://evil.example/x", "jamaal.sn"), false);
  assert.equal(isSafeExternal("http://wa.me/1"), false);
  const out = html("Écrivez-lui : https://wa.me/221771234567 ou [son numéro](https://wa.me/221771234567). Pas ça : https://evil.example/x.");
  assert.match(out, /<a href="https:\/\/wa.me\/221771234567" target="_blank" rel="noopener noreferrer" class="break-all l">Écrire sur WhatsApp<\/a>/);
  assert.match(out, /class="l">son numéro<\/a>/);
  assert.doesNotMatch(out, /href="https:\/\/evil/);
});

test("bloc ``` : carte « Copier / Envoyer sur WhatsApp » si copyable, texte simple sinon", () => {
  const text = "**Message WhatsApp**\n```\nBonjour Mariama 🌸\nVotre parfum : https://wa.me/1\n```\nBonne vente !";
  const card = renderToStaticMarkup(<ChatMarkdown text={text} copyable />);
  assert.match(card, /Copier/);
  assert.match(card, /href="https:\/\/wa.me\/\?text=Bonjour%20Mariama/);
  assert.match(card, /Bonjour Mariama 🌸\nVotre parfum/);
  assert.match(card, /Bonne vente/);
  const plain = html(text);
  assert.doesNotMatch(plain, /Copier/);
  assert.match(plain, /Bonjour Mariama/);
  assert.doesNotMatch(plain, /```/);
});
