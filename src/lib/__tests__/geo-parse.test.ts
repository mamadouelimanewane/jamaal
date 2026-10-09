import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFuzzyAddress, isShortMapLink, parseCoordinates, parseLocation, parseMapLink, parsePlusCode } from "../geo-parse";

const near = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("coordonnées décimales, virgule décimale et degrés-minutes-secondes", () => {
  const a = parseCoordinates("14.7167, -17.4677")!;
  near(a.lat, 14.7167);
  near(a.lng, -17.4677);
  const b = parseCoordinates("14,7167 -17,4677")!;
  near(b.lat, 14.7167);
  near(b.lng, -17.4677);
  const c = parseCoordinates(`14°43'0"N 17°28'4"W`)!;
  near(c.lat, 14.716667);
  near(c.lng, -17.467778);
  assert.equal(parseCoordinates("Sacré-Cœur 3"), null);
  assert.equal(parseCoordinates("0, 0"), null);
  assert.equal(parseCoordinates("120, 10"), null);
});

test("liens Google Maps, WhatsApp, OSM, Apple et geo:", () => {
  const cases: [string, number, number][] = [
    ["https://www.google.com/maps/place/Pharmacie/@14.7,-17.46,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d14.7169!4d-17.4677", 14.7169, -17.4677],
    ["https://maps.google.com/maps?q=14.6928,-17.4467&z=17", 14.6928, -17.4467],
    ["https://www.google.com/maps/search/?api=1&query=14.75%2C-17.39", 14.75, -17.39],
    ["https://www.google.com/maps/@14.7012,-17.4511,15z", 14.7012, -17.4511],
    ["geo:14.71,-17.47?z=16", 14.71, -17.47],
    ["https://www.openstreetmap.org/?mlat=14.7&mlon=-17.45#map=17/14.7/-17.45", 14.7, -17.45],
    ["https://www.openstreetmap.org/#map=17/14.7123/-17.4456", 14.7123, -17.4456],
    ["https://maps.apple.com/?ll=14.72,-17.48&q=Chez%20moi", 14.72, -17.48],
  ];
  for (const [url, lat, lng] of cases) {
    const p = parseMapLink(url);
    assert.ok(p, url);
    near(p.lat, lat);
    near(p.lng, lng);
  }
  assert.ok(isShortMapLink("https://maps.app.goo.gl/AbCdEf123"));
  assert.ok(!isShortMapLink("https://www.google.com/maps/@14.7,-17.4,15z"));
});

test("Plus Codes complets et courts (relatifs à Dakar)", () => {
  const full = parsePlusCode("7C64PG8J+MW")!;
  near(full.lat, 14.71669, 1e-4);
  near(full.lng, -17.46769, 1e-4);
  const short = parsePlusCode("PG8J+MW Dakar")!;
  near(short.lat, full.lat, 1e-6);
  near(short.lng, full.lng, 1e-6);
  assert.equal(parsePlusCode("bonjour"), null);
});

test("parseLocation indique la source", () => {
  assert.equal(parseLocation("14.7, -17.4")?.source, "coordonnees");
  assert.equal(parseLocation("https://maps.google.com/?q=14.7,-17.4")?.source, "lien");
  assert.equal(parseLocation("PG8J+MW")?.source, "plus-code");
  assert.equal(parseLocation("Liberté 6, près du rond-point"), null);
});

test("adresse floue : repères et numéros retirés, morceaux à chercher", () => {
  const q = cleanFuzzyAddress("Villa 123 Sacré-Cœur 3, près de la pharmacie Mame Diarra");
  assert.equal(q[0], "Sacré-Cœur 3, la pharmacie Mame Diarra");
  assert.ok(q.includes("Sacré-Cœur 3"));
  assert.ok(q.includes("la pharmacie Mame Diarra"));
  assert.ok(q.length <= 5);
  assert.deepEqual(cleanFuzzyAddress("en face"), []);
});

test("adresse floue : repères accentués (à côté de, derrière)", () => {
  assert.deepEqual(cleanFuzzyAddress("Ouakam à côté de la mosquée"), ["Ouakam, la mosquée", "Ouakam", "la mosquée"]);
  assert.deepEqual(cleanFuzzyAddress("derrière le marché Tilène, Médina"), ["le marché Tilène, Médina", "le marché Tilène", "Médina"]);
});

test("adresse floue : numéros de villa, étage, immeuble retirés sans couper les noms", () => {
  assert.deepEqual(cleanFuzzyAddress("Immeuble 4B 2e étage, Mermoz"), ["Mermoz"]);
  assert.ok(cleanFuzzyAddress("Villa n° 45 Liberté 6 Extension").includes("Liberté 6 Extension"));
  assert.ok(cleanFuzzyAddress("Point E, rue de Kaolack")[0].includes("Point E"));
  assert.ok(cleanFuzzyAddress("Nord Foire villa 12")[0] === "Nord Foire");
});
