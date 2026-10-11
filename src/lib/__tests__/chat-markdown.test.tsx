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
