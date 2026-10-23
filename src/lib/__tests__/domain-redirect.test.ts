import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyRedirect } from "../domain-redirect";

test("ancienne adresse : pages redirigées vers www.jamaal.sn, API et webhooks conservés", () => {
  assert.equal(legacyRedirect("jamaal-nine.vercel.app", "GET", "/produits/aqua", "?ref=awa"), "https://www.jamaal.sn/produits/aqua?ref=awa");
  assert.equal(legacyRedirect("JAMAAL-NINE.vercel.app:443", "HEAD", "/", ""), "https://www.jamaal.sn/");
  assert.equal(legacyRedirect("jamaal-nine.vercel.app", "POST", "/admin/login", ""), null);
  assert.equal(legacyRedirect("jamaal-nine.vercel.app", "GET", "/api/payment/wave/webhook", ""), null);
  assert.equal(legacyRedirect("jamaal-nine.vercel.app", "GET", "/_next/static/x.js", ""), null);
  assert.equal(legacyRedirect("www.jamaal.sn", "GET", "/", ""), null);
  assert.equal(legacyRedirect("jamaal-git-main-x.vercel.app", "GET", "/", ""), null);
  assert.equal(legacyRedirect(null, "GET", "/", ""), null);
});
