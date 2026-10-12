import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import {
  classifyQuery,
  eurToFcfa,
  parseProductDetail,
  parseSearchResults,
  rankCards,
  splitBatch,
  suggestCategory,
} from "../chogan/parse";
import { createZip, crc32 } from "../zip";

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), "src/lib/__tests__/fixtures/chogan", name), "utf8");
// Les vraies pages sont indentées sur plusieurs lignes : on teste aussi cette forme.
const indented = (html: string) => html.replace(/> </g, ">\n      <");

test("fiche teinte (MM041) : code, nom, teinte, format, prix, 4 photos, teintes sœurs", () => {
  for (const html of [fixture("detail-9479.html"), indented(fixture("detail-9479.html"))]) {
    const d = parseProductDetail(html);
    assert.ok(d);
    assert.equal(d.number, 9479);
    assert.equal(d.code, "MM041");
    assert.equal(d.name, "Blush & Kiss | Multi-use Stick");
    assert.equal(d.shade, "Peach");
    assert.equal(d.format, "7 g");
    assert.equal(d.publicPriceEur, 19.9);
    assert.equal(d.brand, "moniamori");
    assert.deepEqual(d.breadcrumb, ["Beauté", "Maquillage", "Visage"]);
    assert.equal(d.images.length, 4);
    assert.equal(d.images[0], "https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg");
    assert.deepEqual(d.shades, [
      { number: 9484, code: "MM040" },
      { number: 9479, code: "MM041" },
      { number: 9474, code: "MM042" },
    ]);
    assert.deepEqual(d.formats, []);
    assert.equal(d.notes, null);
    assert.equal(d.description.length, 1, "la ligne « Teinte : Peach » est retirée");
    assert.match(d.description[0], /^Blush & Kiss Stick de MoniAmori est un stick au fini mat/);
  }
});

test("fiche parfum (Amphera) : formats, notes olfactives, ligne CPNP retirée", () => {
  const d = parseProductDetail(indented(fixture("detail-16201.html")));
  assert.ok(d);
  assert.equal(d.number, 16201);
  assert.equal(d.code, "AMPHERA");
  assert.equal(d.name, "Amphera – Parfum Femme Luxury Extrait 30 %");
  assert.equal(d.shade, null);
  assert.equal(d.format, "50 ml");
  assert.equal(d.publicPriceEur, 60);
  assert.equal(d.images.length, 5);
  assert.deepEqual(d.formats, [
    { number: 16201, label: "50 ml", priceEur: 60 },
    { number: 16211, label: "15 ml", priceEur: 20.9 },
    { number: 16216, label: "3 ml", priceEur: 2.3 },
  ]);
  assert.ok(d.notes);
  assert.ok(d.notes.top.includes("Bergamote"));
  assert.ok(d.notes.heart.includes("Fleur d'oranger"));
  assert.ok(d.notes.base.includes("Vanille"));
  assert.ok(d.description.every((l) => !/CPNP/.test(l)));
  assert.equal(suggestCategory(d.breadcrumb, d.name, d.code), "parfum-femme");
});

test("une page qui n'est pas une fiche donne null", () => {
  assert.equal(parseProductDetail("<html><body>Maintenance</body></html>"), null);
  assert.equal(parseProductDetail(fixture("search-blush.html")), null);
});

test("résultats de recherche : une carte par fiche, vide si aucun résultat", () => {
  const cards = parseSearchResults(indented(fixture("search-blush.html")));
  assert.deepEqual(
    cards.map((c) => [c.number, c.code, c.name, c.format, c.priceEur]),
    [
      [9484, "MM040", "Blush & Kiss | Multi-use Stick", "7 g", 19.9],
      [9479, "MM041", "Blush & Kiss | Multi-use Stick", "7 g", 19.9],
      [9474, "MM042", "Blush & Kiss | Multi-use Stick", "7 g", 19.9],
    ]
  );
  assert.equal(cards[1].image, "https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg");
  assert.deepEqual(parseSearchResults(fixture("search-empty.html")), []);
});

test("classement par nom : la teinte saisie passe en premier, un code identique avant tout", () => {
  const cards = parseSearchResults(fixture("search-blush.html"));
  assert.equal(rankCards("blush kiss peach", cards)[0].code, "MM041");
  assert.equal(rankCards("Blush & Kiss Berry", cards)[0].code, "MM042");
  assert.equal(rankCards("mm040", cards)[0].code, "MM040");
});

test("saisie : lien, n° de fiche, code ou nom", () => {
  assert.deepEqual(classifyQuery("https://www.chogangroupspa.com/chogangroup/productDetail/9479"), { kind: "number", number: 9479, raw: "https://www.chogangroupspa.com/chogangroup/productDetail/9479" });
  assert.equal(classifyQuery("9479")?.kind, "number");
  assert.equal(classifyQuery("n° 9479")?.kind, "number");
  assert.deepEqual(classifyQuery(" mm041 "), { kind: "code", code: "MM041", raw: "mm041" });
  assert.equal(classifyQuery("060")?.kind, "code");
  assert.equal(classifyQuery("001M")?.kind, "code");
  assert.equal(classifyQuery("Amphera")?.kind, "name");
  assert.deepEqual(classifyQuery("Blush & Kiss  Peach"), { kind: "name", text: "Blush & Kiss Peach", raw: "Blush & Kiss  Peach" });
  assert.equal(classifyQuery("   "), null);
});

test("saisie par lots : une ligne par requête, plusieurs codes sur une ligne, sans doublon", () => {
  assert.deepEqual(splitBatch("MM041, MM042;9474\nBlush & Kiss Peach\n\n- Amphera\nmm041\n"), ["MM041", "MM042", "9474", "Blush & Kiss Peach", "Amphera"]);
  assert.equal(splitBatch(Array.from({ length: 80 }, (_, i) => `C${i}`).join("\n")).length, 50);
});

test("prix : parité fixe euro / franc CFA", () => {
  assert.equal(eurToFcfa(19.9), 13054);
  assert.equal(eurToFcfa(60), 39357);
});

test("catégorie proposée", () => {
  assert.equal(suggestCategory(["Beauté", "Maquillage", "Visage"], "Blush & Kiss | Multi-use Stick", "MM041"), "maquillage");
  assert.equal(suggestCategory(["Maison", "Nettoyants"], "Dégraissant", "X12"), "entretien-maison");
  assert.equal(suggestCategory(["Parfums"], "Volt – Parfum Homme Luxury Extrait 30 %", "VOLT"), "parfum-homme");
  assert.equal(suggestCategory([], "Objet inconnu", "Z9"), "autres-produits");
});

test("archive ZIP lisible par un outil standard", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const zip = createZip([
    { name: "MM041-peach-1.jpg", data: new Uint8Array([1, 2, 3, 4]) },
    { name: "été/é.txt", data: new TextEncoder().encode("bonjour") },
  ]);
  const file = path.join(os.tmpdir(), `jamaal-test-${process.pid}.zip`);
  fs.writeFileSync(file, zip);
  try {
    const out = execFileSync("python3", ["-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('|'.join(i.filename+':'+str(i.file_size) for i in z.infolist()))", file]).toString().trim();
    assert.equal(out, "MM041-peach-1.jpg:4|été/é.txt:7");
  } catch (e) {
    // Sans python3 (poste Windows), on vérifie au moins la signature de fin d'archive.
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    assert.equal(new DataView(zip.buffer).getUint32(zip.length - 22, true), 0x06054b50);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

import { buildPreview, photoFileName } from "../chogan/preview";
import { DEFAULT_BUSINESS_MODEL } from "../business-model";

test("aperçu MM041 : identique à la fiche créée à la main (nom, prix public et prix de vente)", () => {
  const d = parseProductDetail(fixture("detail-9479.html"))!;
  const p = buildPreview(d, DEFAULT_BUSINESS_MODEL);
  assert.equal(p.name, "Blush & Kiss | Multi-use Stick — Peach");
  assert.equal(p.publicPrice, 13054);
  assert.equal(p.regularPrice, 16300);
  assert.equal(p.category, "maquillage");
  assert.equal(p.volumes, null);
  assert.equal(p.images.length, 4);
  assert.match(p.shortDescription, /^Blush & Kiss Stick de MoniAmori est un stick au fini mat et à la couvrance modulable\. Produit Chogan/);
  assert.ok(p.longDescription.at(-1)!.startsWith("Produit officiel de la gamme Chogan"));
  assert.ok(p.longDescription.some((l) => l.includes("teinte Peach, 7 g")));
  assert.deepEqual(p.allCodes, ["MM041"]);
});

test("aperçu parfum : formats avec leur code et leur prix, notes olfactives", () => {
  const d = parseProductDetail(fixture("detail-16201.html"))!;
  const p = buildPreview(d, DEFAULT_BUSINESS_MODEL, { 16211: "TAMPHERA", 16216: "CAMPHERA" });
  assert.equal(p.name, "Amphera – Parfum Femme Luxury Extrait 30 %");
  assert.deepEqual(p.volumes?.map((v) => [v.label, v.code, v.publicPrice]), [
    ["50 ml", "AMPHERA", 39357],
    ["15 ml", "TAMPHERA", 13710],
    ["3 ml", "CAMPHERA", 1509],
  ]);
  assert.equal(p.volumes?.[0].price, p.regularPrice);
  assert.ok(p.topNotes.includes("Bergamote"));
  assert.deepEqual(p.allCodes, ["AMPHERA", "TAMPHERA", "CAMPHERA"]);
});

test("nom de fichier photo lisible", () => {
  assert.equal(photoFileName("MM041", "Peach", 0, "https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg"), "MM041-peach-1.jpg");
  assert.equal(photoFileName("AMPHERA", "Amphera – Parfum Femme", 2, "https://x/y.JPEG?v=2"), "AMPHERA-amphera-parfum-femme-3.jpg");
});
