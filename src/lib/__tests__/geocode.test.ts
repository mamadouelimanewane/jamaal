import { test } from "node:test";
import assert from "node:assert/strict";
import { expandShortLink, geocodeFuzzy } from "../geocode";

// Sans base de données : le cache est ignoré (erreurs absorbées), seul le réseau simulé répond.
process.env.DATABASE_URL ??= "postgresql://u:p@127.0.0.1:1/none";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

test("adresse floue : premier résultat Photon situé au Sénégal", { skip: !!process.env.DB_TEST }, async () => {
  const urls: string[] = [];
  const fetcher = async (url: string) => {
    urls.push(url);
    if (url.includes("photon")) {
      return json({
        features: [
          { geometry: { coordinates: [2.35, 48.85] }, properties: { name: "Sacré-Cœur", city: "Paris" } },
          { geometry: { coordinates: [-17.4677, 14.7169] }, properties: { name: "Sacré-Cœur 3", city: "Dakar" } },
        ],
      });
    }
    return json([]);
  };
  const r = await geocodeFuzzy("Sacré-Cœur 3 villa 12 près de la pharmacie", fetcher);
  assert.ok(r);
  assert.equal(r.label, "Sacré-Cœur 3, Dakar");
  assert.ok(Math.abs(r.lat - 14.7169) < 1e-6);
  assert.match(urls[0], /q=Sacr%C3%A9-C%C5%93ur%203%2C%20la%20pharmacie%2C%20Dakar/);
});

test("adresse floue : Nominatim en secours, null si rien au Sénégal", { skip: !!process.env.DB_TEST }, async () => {
  const fetcher = async (url: string) => (url.includes("nominatim") ? json([{ lat: "14.75", lon: "-17.39", display_name: "Parcelles Assainies, Dakar, Sénégal" }]) : json({ features: [] }));
  const r = await geocodeFuzzy("Parcelles unité 15 kkkkzz", fetcher);
  assert.equal(r?.source, "nominatim");
  const none = await geocodeFuzzy("zzqqxx introuvable", async () => json({ features: [] }));
  assert.equal(none, null);
});

test("lien court : suit les redirections", async () => {
  const fetcher = async (url: string) =>
    url.includes("goo.gl")
      ? new Response(null, { status: 302, headers: { location: "https://www.google.com/maps/place/@14.7,-17.4,17z" } })
      : new Response(null, { status: 200 });
  assert.equal(await expandShortLink("https://maps.app.goo.gl/abc", fetcher), "https://www.google.com/maps/place/@14.7,-17.4,17z");
});
