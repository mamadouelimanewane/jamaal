#!/usr/bin/env node
/**
 * Associe une photo (CDN Chogan) aux produits déjà au catalogue qui n'en ont pas,
 * en retrouvant le produit Chogan correspondant par son nom.
 * Écrit src/data/photo-fallback.json : { [slug]: url }, utilisé à l'affichage
 * quand un produit n'a pas de photo en base (aucune migration nécessaire).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CDN = "https://cdn.chogangroupspa.com/images/prodotti/big/";
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const core = (name) =>
  norm(name.replace(/\s*[–-]\s*(parfum|extrait|profumo).*$/i, "").replace(/\s+parfum.*$/i, "").replace(/\s+extrait.*$/i, ""));

const existing = JSON.parse(readFileSync(path.join(root, "src/data/official-catalog.json"), "utf8"));
const rows = readFileSync(path.join(root, "import/chogan-raw.txt"), "utf8")
  .split("\n").filter(Boolean)
  .map((l) => { const [id, leaf, , format, img, ...n] = l.split("|"); return { id, leaf, format, img, name: n.join("|").trim() }; });

const byExactName = new Map(rows.map((r) => [norm(r.name), r]));
const stop = new Set(["aux", "des", "les", "pour", "avec", "bio"]);
const toks = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !stop.has(t)));
const others = rows.filter((r) => r.leaf !== "460");
/** Meilleur rapprochement par mots du nom + même format ; seuil élevé pour éviter les mauvaises photos. */
function fuzzy(p) {
  const [base, fmtRaw = ""] = p.name.split(" — ");
  const fmt = fmtRaw.replace(/[ 	]/g, "").toLowerCase();
  const T = toks(base);
  let best = null, bestScore = 0;
  for (const r of others) {
    const R = toks(r.name);
    const score = [...T].filter((t) => R.has(t)).length / Math.max(T.size, R.size) + (fmt && r.format?.replace(/[ 	]/g, "").toLowerCase() === fmt ? 0.15 : 0);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 0.95 ? best : null;
}
const perfumes = rows.filter((r) => r.leaf === "460" && core(r.name).length > 3);

const out = {};
let perfumeHits = 0, nameHits = 0;
for (const p of existing) {
  if (p.photo) continue;
  let hit = byExactName.get(norm(p.name));
  if (hit) nameHits++;
  if (!hit && !p.category.startsWith("parfum-")) { hit = fuzzy(p); if (hit) nameHits++; }
  if (!hit && p.category.startsWith("parfum-")) {
    // Les parfums JAMAAL N°x citent le nom Chogan entre « » dans leur description.
    const quoted = (p.shortDescription.match(/«\s*([^»]+?)\s*»/) || [])[1];
    if (quoted) {
      const q = norm(quoted);
      hit = perfumes.find((r) => core(r.name) === q);
      if (hit) perfumeHits++;
    }
  }
  if (hit) out[p.slug] = CDN + hit.img;
}

writeFileSync(path.join(root, "src/data/photo-fallback.json"), JSON.stringify(out, null, 1) + "\n");
const missing = existing.filter((p) => !p.photo && !out[p.slug]);
console.log(`Photos associées : ${Object.keys(out).length} (parfums ${perfumeHits}, noms exacts ${nameHits}). Sans photo : ${missing.length}.`);
const byCat = missing.reduce((a, p) => ((a[p.category] = (a[p.category] ?? 0) + 1), a), {});
console.log(byCat);
