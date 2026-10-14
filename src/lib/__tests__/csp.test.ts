import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsp, newNonce } from "../csp";

test("CSP : scripts limités au nonce de la requête, jamais unsafe-inline", () => {
  const csp = buildCsp("abc123");
  assert.match(csp, /script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
  const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test("CSP : unsafe-eval seulement en développement, nonce différent à chaque requête", () => {
  assert.match(buildCsp("n", true), /unsafe-eval/);
  assert.doesNotMatch(buildCsp("n", false), /unsafe-eval/);
  assert.notEqual(newNonce(), newNonce());
});
