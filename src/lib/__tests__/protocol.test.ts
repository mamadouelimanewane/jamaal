import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROTOCOL_TEXT, fillProtocol, normalizeProtocol, pieceLabel, protocolBlocks } from "../protocol";
import { protocolPdf } from "../protocol-pdf";

test("protocole par défaut : 17 articles, champs du signataire remplis", () => {
  const blocks = protocolBlocks(DEFAULT_PROTOCOL_TEXT);
  assert.equal(blocks.filter((b) => b.kind === "h" && b.text.startsWith("Article")).length, 17);
  const t = fillProtocol(DEFAULT_PROTOCOL_TEXT, { nom: "Awa Diop", piece: pieceLabel("CNI", "1234567890123"), adresse: "Sacré-Cœur 3", telephone: "771234567", code_parrain: "aminata" });
  assert.match(t, /le Partenaire : Awa Diop, titulaire de la pièce d'identité Carte nationale d'identité n° 1234567890123, demeurant Sacré-Cœur 3/);
  assert.doesNotMatch(t, /\{(nom|piece|adresse|telephone|code_parrain)\}/);
  assert.match(fillProtocol("{nom} {adresse}", { nom: "X" }), /^X ……………… ?$|^X ………………$/);
});

test("protocole : version et texte enregistrés", () => {
  assert.equal(normalizeProtocol(null).version, 1);
  assert.equal(normalizeProtocol({ version: 3, text: "court" }).text, DEFAULT_PROTOCOL_TEXT);
  const long = "## Article 1\n\n" + "x".repeat(300);
  assert.deepEqual(normalizeProtocol({ version: 4, text: long }).version, 4);
  assert.deepEqual(protocolBlocks("## Titre\n\nPara un\n- puce\n1. un\n2. deux").map((b) => b.kind), ["h", "p", "li", "ol", "ol"]);
});

test("PDF du protocole signé", async () => {
  // PNG 1×1 transparent
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
  const pdf = await protocolPdf({ version: 2, text: fillProtocol(DEFAULT_PROTOCOL_TEXT, { nom: "Awa Diop" }) + "\n\nSymbole → ≤ œuvre", textHash: "abc", signerName: "Awa Diop", piece: "Passeport n° A123", address: "Dakar", phone: "77", image: png, ip: "1.2.3.4", signedAt: new Date("2026-10-09T12:00:00Z") });
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  assert.ok(pdf.length > 5000);
});
