#!/usr/bin/env node
/**
 * Contrôle du catalogue Chogan : chaque produit a-t-il une image valide, qui correspond
 * bien à l'article Chogan d'origine ? Y a-t-il des doublons ?
 * Usage : node scripts/check-images.mjs
 */
import { readFileSync } from "node:fs";

const chogan = JSON.parse(readFileSync("src/data/chogan-catalog.json", "utf8"));
const raw = readFileSync("import/chogan-raw.txt", "utf8").split("\n").filter(Boolean)
  .map((l) => { const [id, , eur, format, img, ...n] = l.split("|"); return { id, eur: Number(eur), format, img, name: n.join("|").trim() }; });
const rawById = new Map(raw.map((r) => [`chogan-${r.id}`, r]));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const problems = { sansOrigine: [], nomIncoherent: [], imageIncoherente: [], genreIncoherent: [], prixIncoherent: [], urlInjoignable: [], doublonsId: [], sansPhoto: [] };
const seen = new Set();
for (const p of chogan) {
  const r = rawById.get(p.id);
  if (!r) { problems.sansOrigine.push(p.name); continue; }
  if (seen.has(p.id)) problems.doublonsId.push(p.id);
  seen.add(p.id);
  if (!p.photo) problems.sansPhoto.push(p.name);
  if (norm(p.name.split(" — réf.")[0]) !== norm(r.name)) problems.nomIncoherent.push(`${p.name} <> ${r.name}`);
  if (p.photo && !p.photo.endsWith("/" + r.img)) problems.imageIncoherente.push(p.name);
  const img = r.img.toLowerCase();
  if ((img.includes("uomo") && p.category === "parfum-femme") || (img.includes("donna") && p.category === "parfum-homme"))
    problems.genreIncoherent.push(`${p.name} (${p.category}) -> ${r.img}`);
  const expected = Math.max(100, Math.round((r.eur * 655.957 * 1.2 * 0.8) / 100) * 100);
  if (p.regularPrice !== expected) problems.prixIncoherent.push(`${p.name}: ${p.regularPrice} <> ${expected}`);
}
const missing = raw.filter((r) => !seen.has(`chogan-${r.id}`));

const urls = [...new Set(chogan.map((p) => p.photo).filter(Boolean))];
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

console.log(`Produits du site : ${chogan.length} | lignes Chogan d'origine : ${raw.length} | non importées : ${missing.length}`);
console.log(`Images distinctes : ${urls.length}, valides : ${ok}`);
for (const [k, v] of Object.entries(problems)) console.log(`${k}: ${v.length}`, v.slice(0, 5));
