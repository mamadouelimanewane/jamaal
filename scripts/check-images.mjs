#!/usr/bin/env node
/**
 * Contrôle des images produits : chaque image existe-t-elle, correspond-elle au bon
 * produit, est-elle partagée par erreur ?
 * Usage : node scripts/check-images.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";

const official = JSON.parse(readFileSync("src/data/official-catalog.json", "utf8"));
const chogan = JSON.parse(readFileSync("src/data/chogan-catalog.json", "utf8"));
const fallback = JSON.parse(readFileSync("src/data/photo-fallback.json", "utf8"));
const raw = readFileSync("import/chogan-raw.txt", "utf8").split("\n").filter(Boolean)
  .map((l) => { const [id, leaf, , format, img, ...n] = l.split("|"); return { id, leaf, format, img, name: n.join("|").trim() }; });
const rawByImg = new Map(raw.map((r) => [r.img, r]));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const all = [
  ...official.map((p) => ({ ...p, photo: p.photo || fallback[p.slug] || null, src: p.photo ? "local" : fallback[p.slug] ? "fallback" : "aucune" })),
  ...chogan.map((p) => ({ ...p, src: "chogan" })),
];

const problems = { fichierLocalManquant: [], urlInjoignable: [], doublons: [], genreIncoherent: [], nomIncoherent: [] };
const stats = { total: all.length, local: 0, fallback: 0, chogan: 0, aucune: 0 };
const imgUsers = new Map();

for (const p of all) {
  stats[p.src]++;
  if (!p.photo) continue;
  if (p.photo.startsWith("/")) {
    if (!existsSync("public" + p.photo)) problems.fichierLocalManquant.push(`${p.name} -> ${p.photo}`);
  }
  const arr = imgUsers.get(p.photo) ?? [];
  arr.push(p);
  imgUsers.set(p.photo, arr);

  // Cohérence avec le nom Chogan d'origine (images CDN)
  const file = p.photo.split("/").pop();
  const r = rawByImg.get(file);
  if (r) {
    if (p.src === "chogan") {
      const expected = p.name.split(" — réf.")[0];
      if (norm(expected) !== norm(r.name)) problems.nomIncoherent.push(`${p.name} <> ${r.name}`);
    }
    const cat = p.category;
    const img = file.toLowerCase();
    if ((img.includes("uomo") && cat === "parfum-femme") || (img.includes("donna") && cat === "parfum-homme"))
      problems.genreIncoherent.push(`${p.name} (${cat}) -> ${file}`);
  }
}

for (const [url, users] of imgUsers) {
  const names = new Set(users.map((u) => norm(u.name.split(" — réf.")[0])));
  if (users.length > 1 && names.size > 1) problems.doublons.push(`${url.split("/").pop()} : ${users.map((u) => u.name).join(" | ")}`);
}

// Accessibilité des URL distantes (par lots)
const urls = [...imgUsers.keys()].filter((u) => u.startsWith("http"));
let ok = 0;
for (let i = 0; i < urls.length; i += 25) {
  await Promise.all(urls.slice(i, i + 25).map(async (u) => {
    try {
      const res = await fetch(u, { method: "HEAD" });
      if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) ok++;
      else problems.urlInjoignable.push(`${u} (${res.status})`);
    } catch (e) { problems.urlInjoignable.push(`${u} (${e.message})`); }
  }));
}

// Fichiers locaux jamais utilisés
const used = new Set(all.map((p) => p.photo).filter((x) => x && x.startsWith("/produits/")).map((x) => x.replace("/produits/", "")));
const orphelins = readdirSync("public/produits").filter((f) => !used.has(f));

console.log("Produits:", stats);
console.log(`URL distantes uniques: ${urls.length}, OK: ${ok}`);
for (const [k, v] of Object.entries(problems)) console.log(`\n${k}: ${v.length}`, v.slice(0, 8));
console.log(`\nFichiers locaux non utilisés: ${orphelins.length}`, orphelins.slice(0, 10));
