#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS script using Node built-ins. */
/**
 * Convertit un listing de prix Chogan (PDF Canva « Listino Profumi Tribe ») en src/data/chogan-listino.json.
 * Usage : node scripts/pdf-listino.cjs "chemin/listino.pdf" [sortie.json]
 *
 * Extracteur de texte PDF minimal (PDF 1.4, flux Flate, polices ToUnicode, formulaires imbriqués), sans dépendance.
 * Le texte est lu par positions : un écart de 4,7 à 9 points = espace, 9 et plus = nouvelle colonne.
 * À relire après chaque nouveau listing : la section « À vérifier » liste les lignes douteuses.
 */
const fs = require("fs");
const zlib = require("zlib");

const src = fs.readFileSync(process.argv[2]).toString("latin1");

// ---------- objets ----------
const objs = new Map();
const starts = [];
for (const m of src.matchAll(/(\d+) 0 obj/g)) starts.push({ n: +m[1], at: m.index + m[0].length });
for (let i = 0; i < starts.length; i++) {
  const end = src.indexOf("endobj", starts[i].at);
  const body = src.slice(starts[i].at, end < 0 ? undefined : end);
  const sIdx = body.indexOf("stream");
  let dict = body, data = null;
  if (sIdx >= 0 && /^\s*<</.test(body)) {
    dict = body.slice(0, sIdx);
    let a = sIdx + 6;
    if (body[a] === "\r") a++;
    if (body[a] === "\n") a++;
    data = Buffer.from(body.slice(a, body.lastIndexOf("endstream")), "latin1");
  }
  objs.set(starts[i].n, { dict, data });
}
function inflate(o) {
  if (!o || !o.data) return null;
  if (!/FlateDecode/.test(o.dict)) return o.data;
  try { return zlib.inflateSync(o.data); } catch { try { return zlib.inflateSync(o.data, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { return null; } }
}
const ref = (txt, key) => { const r = txt.match(new RegExp("/" + key + "\\s+(\\d+) 0 R")); return r ? +r[1] : null; };

// ---------- pages dans l'ordre ----------
let root = null;
for (const [n, o] of objs) if (/\/Type\s*\/Pages/.test(o.dict) && !/\/Parent/.test(o.dict)) root = n;
const pageList = [];
(function walk(n) {
  const o = objs.get(n);
  if (!o) return;
  if (/\/Type\s*\/Pages/.test(o.dict)) {
    const kids = (o.dict.match(/\/Kids\s*\[([^\]]*)\]/) || [, ""])[1];
    for (const k of kids.matchAll(/(\d+) 0 R/g)) walk(+k[1]);
  } else pageList.push(n);
})(root);

// ---------- polices ----------
const cmapCache = new Map();
function parseCMap(n) {
  if (cmapCache.has(n)) return cmapCache.get(n);
  const data = inflate(objs.get(n));
  const map = new Map();
  if (data) {
    const t = data.toString("latin1");
    const u = (hex) => { let s = ""; for (let i = 0; i < hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16)); return s; };
    for (const blk of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const p of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(parseInt(p[1], 16), u(p[2]));
    for (const blk of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
      for (const p of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)) {
        const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
        if (p[4]) { const base = parseInt(p[4], 16); for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(base + (c - lo))); }
        else { const arr = [...p[5].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => u(x[1])); for (let c = lo; c <= hi; c++) map.set(c, arr[c - lo] || ""); }
      }
  }
  cmapCache.set(n, map);
  return map;
}
function resText(dict) {
  const r = dict.match(/\/Resources\s*(\d+) 0 R/);
  return r && objs.get(+r[1]) ? objs.get(+r[1]).dict : dict;
}
function subDict(rtxt, key) {
  const r = rtxt.match(new RegExp("/" + key + "\\s*(\\d+) 0 R"));
  if (r && objs.get(+r[1])) return objs.get(+r[1]).dict;
  const i = rtxt.search(new RegExp("/" + key + "\\s*<<"));
  if (i < 0) return "";
  let d = 0, j = rtxt.indexOf("<<", i);
  const st = j;
  for (; j < rtxt.length; j++) {
    if (rtxt.startsWith("<<", j)) { d++; j++; } else if (rtxt.startsWith(">>", j)) { d--; j++; if (!d) return rtxt.slice(st, j + 1); }
  }
  return rtxt.slice(st);
}
function fontsFromRes(rtxt) {
  const out = {};
  for (const f of subDict(rtxt, "Font").matchAll(/\/([\w.+-]+)\s+(\d+) 0 R/g)) {
    const fo = objs.get(+f[2]);
    const tu = fo && ref(fo.dict, "ToUnicode");
    out[f[1]] = { map: tu ? parseCMap(tu) : null, twoByte: /Type0/.test(fo ? fo.dict : "") };
  }
  return out;
}
function xobjectsFromRes(rtxt) {
  const out = {};
  for (const f of subDict(rtxt, "XObject").matchAll(/\/([\w.+-]+)\s+(\d+) 0 R/g)) out[f[1]] = +f[2];
  return out;
}

// ---------- contenu ----------
function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "<" && s[i + 1] === "<") { t.push({ k: "op", v: "<<" }); i += 2; continue; }
    if (c === ">" && s[i + 1] === ">") { t.push({ k: "op", v: ">>" }); i += 2; continue; }
    if (c === "<") { const e = s.indexOf(">", i); t.push({ k: "hex", v: s.slice(i + 1, e).replace(/\s/g, "") }); i = e + 1; continue; }
    if (c === "(") {
      let d = 1, j = i + 1, out = "";
      while (j < s.length && d) {
        const ch = s[j];
        if (ch === "\\") { out += s[j + 1]; j += 2; continue; }
        if (ch === "(") d++;
        if (ch === ")") { d--; if (!d) break; }
        out += ch; j++;
      }
      t.push({ k: "str", v: out }); i = j + 1; continue;
    }
    if (c === "[" || c === "]") { t.push({ k: "op", v: c }); i++; continue; }
    if (c === "/") { let j = i + 1; while (j < s.length && !/[\s/[\]<>()]/.test(s[j])) j++; t.push({ k: "name", v: s.slice(i + 1, j) }); i = j; continue; }
    let j = i; while (j < s.length && !/[\s/[\]<>()]/.test(s[j])) j++;
    const w = s.slice(i, j);
    t.push(/^[-+]?[\d.]+$/.test(w) ? { k: "num", v: parseFloat(w) } : { k: "op", v: w }); i = j;
  }
  return t;
}
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

const stats = { images: 0, forms: 0 };
function run(content, rtxt, ctm0, depth) {
  const fonts = fontsFromRes(rtxt);
  const xobjs = xobjectsFromRes(rtxt);
  const toks = tokenize(content);
  let ctm = ctm0, tm = [1, 0, 0, 1, 0, 0], tlm = tm, font = null, leading = 0;
  const stack = [], chunks = [], operands = [];
  const decode = (tok) => {
    const bytes = tok.k === "hex" ? (tok.v.length % 2 ? tok.v + "0" : tok.v).match(/../g).map((h) => parseInt(h, 16)) : [...tok.v].map((c) => c.charCodeAt(0) & 255);
    if (!font || !font.map) return bytes.map((b) => String.fromCharCode(b)).join("");
    let out = "";
    if (font.twoByte) for (let i = 0; i + 1 < bytes.length; i += 2) out += font.map.get((bytes[i] << 8) | bytes[i + 1]) ?? "";
    else for (const b of bytes) out += font.map.get(b) ?? String.fromCharCode(b);
    return out;
  };
  const emit = (text) => { if (text) { const p = mul(tm, ctm); chunks.push({ x: p[4], y: p[5], t: text }); } };
  for (const tk of toks) {
    if (tk.k !== "op" || ["[", "]", "<<", ">>"].includes(tk.v)) { operands.push(tk); continue; }
    const op = tk.v, nums = operands.filter((x) => x.k === "num").map((x) => x.v);
    if (op === "q") stack.push(ctm);
    else if (op === "Q") ctm = stack.pop() || ctm;
    else if (op === "cm" && nums.length >= 6) ctm = mul(nums.slice(-6), ctm);
    else if (op === "Do" && depth < 8) {
      const nm = operands.find((x) => x.k === "name");
      const xo = nm && objs.get(xobjs[nm.v]);
      if (xo && /\/Subtype\s*\/Form/.test(xo.dict)) {
        stats.forms++;
        const mt = xo.dict.match(/\/Matrix\s*\[([^\]]*)\]/);
        const mx = mt ? mt[1].trim().split(/\s+/).map(Number) : [1, 0, 0, 1, 0, 0];
        const data = inflate(xo);
        if (data) chunks.push(...run(data.toString("latin1"), resText(xo.dict) || rtxt, mul(mx, ctm), depth + 1));
      } else if (xo) stats.images++;
    }
    else if (op === "BT") { tm = [1, 0, 0, 1, 0, 0]; tlm = tm; }
    else if (op === "Tf") { const nm = operands.find((x) => x.k === "name"); font = nm ? fonts[nm.v] || null : null; }
    else if (op === "Tm" && nums.length >= 6) { tm = nums.slice(-6); tlm = tm; }
    else if ((op === "Td" || op === "TD") && nums.length >= 2) { if (op === "TD") leading = -nums[nums.length - 1]; tlm = mul([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm); tm = tlm; }
    else if (op === "TL" && nums.length) leading = nums[nums.length - 1];
    else if (op === "T*") { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; }
    else if (op === "Tj" || op === "'" || op === '"') { const s = [...operands].reverse().find((x) => x.k === "hex" || x.k === "str"); if (s) emit(decode(s)); }
    else if (op === "TJ") { let text = ""; for (const x of operands) if (x.k === "hex" || x.k === "str") text += decode(x); emit(text); }
    operands.length = 0;
  }
  return chunks;
}

function pageChunks(pageN) {
  const o = objs.get(pageN);
  const cts = [];
  const arr = o.dict.match(/\/Contents\s*\[([^\]]*)\]/);
  if (arr) for (const k of arr[1].matchAll(/(\d+) 0 R/g)) cts.push(+k[1]);
  else { const r = ref(o.dict, "Contents"); if (r) cts.push(r); }
  const content = Buffer.concat(cts.map((n) => inflate(objs.get(n)) || Buffer.alloc(0))).toString("latin1");
  return run(content, resText(o.dict), [1, 0, 0, 1, 0, 0], 0);
}

// ---------- lignes par ordonnée ----------
const pages = pageList.map((n) => {
  const ch = pageChunks(n).filter((c) => c.t.trim());
  ch.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const c of ch) {
    const r = rows.find((r) => Math.abs(r.y - c.y) <= 3);
    if (r) r.items.push(c); else rows.push({ y: c.y, items: [c] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => { const it = r.items.sort((a, b) => a.x - b.x); let out = ""; it.forEach((c, i) => { if (i) { const dx = c.x - it[i - 1].x; out += dx >= 9 ? "  |  " : dx >= 4.7 ? " " : ""; } out += c.t.trim(); }); return out; });
});

// ---------- lecture du listing ----------
const price = (l) => [...l.matchAll(/(\d{1,3})[.,](\d\d) ?€/g)].map((m) => +(m[1] + "." + m[2]));
const isCode = (x) => /^\d{3,4}[MWU]?$/.test(x.replace(/\s/g, ""));
const warnings = [];

// Parfums 15 / 30 / 70 ml : lignes « code70 | code30 | codeT15 | nom | inspiré de | marque | 3 prix ».
const parfums = new Map();
pages.slice(1, 5).forEach((lines0) => {
  const lines = lines0.map((l) => l.trim()).filter(Boolean).filter((l) => !/^(L \||U \||D \||70 M L|0 ?M)/.test(l));
  lines.forEach((l, i) => {
    const f = l.split("  |  ").map((x) => x.trim());
    if (!isCode(f[0])) return;
    const code = f[0].replace(/\s/g, "");
    const others = f.filter((x) => /^T?\d{3,4}[MWU]?$/.test(x.replace(/\s/g, ""))).map((x) => x.replace(/\s/g, ""));
    let code30 = others.find((c) => /^3\d{2,3}[MWU]?$/.test(c) && c !== code) || null;
    let code15 = others.find((c) => /^T/.test(c)) || null;
    let pr = price(l);
    // Une ligne coupée à l'extraction : prix, code 30 ml ou code recharge se retrouvent sur la ligne voisine.
    for (const j of [i + 1, i - 1]) {
      if (!lines[j]) continue;
      const g = lines[j].split("  |  ").map((x) => x.trim());
      if (isCode(g[0])) continue;
      if (pr.length < 3) pr = pr.concat(price(lines[j]));
      code15 = code15 || (g.find((x) => /^T\d/.test(x.replace(/\s/g, ""))) || "").replace(/\s/g, "") || null;
    }
    pr = [...new Set(pr)].sort((a, b) => a - b).slice(-3);
    if (parfums.has(code)) return;
    if (!code30) { code30 = "3" + code.replace(/^0/, ""); warnings.push(`${code} : code 30 ml déduit (${code30})`); }
    if (!code15) { code15 = "T" + code; warnings.push(`${code} : code recharge déduit (${code15})`); }
    parfums.set(code, { code, code30, code15, eur: pr.length >= 3 ? { 15: pr[0], 30: pr[1], 70: pr[2] } : null });
  });
});

// Ligne coupée : un code 30 ml (ex. 347W) apparu comme une ligne à part est rattaché à son parfum (047W), avec ses prix.
for (const [c, r] of [...parfums]) {
  if (!/^3\d{2,3}[MWU]?$/.test(c)) continue;
  const rest = c.slice(1);
  const base = parfums.get((rest.length === 3 ? "0" : "") + rest);
  if (!base) continue;
  base.code30 = c;
  if (!base.eur && r.eur) base.eur = r.eur;
  parfums.delete(c);
  warnings.push(`${c} : rattaché à ${base.code} (ligne coupée dans le PDF)`);
}
for (const [c, r] of [...parfums]) if (!r.eur) { warnings.push(`${c} : prix 15/30/70 ml introuvables, ligne ignorée`); parfums.delete(c); }

// Luxury : 50 ml + recharge 15 ml ; éditions limitées (NADIR, IMPERATRIX…) à 20,90 € / 60 €.
const luxury = [];
for (const raw of pages[5] || []) {
  const l = raw.trim();
  const f = l.split("  |  ").map((x) => x.trim());
  const pr = price(l);
  const m = f[0].replace(/\s/g, "").match(/^(\d{3}[MWU]?)$/);
  if (m && /^T\d/.test((f[1] || "").replace(/\s/g, "")) && pr.length >= 2) luxury.push({ code: m[1], code15: f[1].replace(/\s/g, ""), eur: { 15: Math.min(...pr), 50: Math.max(...pr) } });
}
for (const n of ["NADIR", "IMPERATRIX", "AMPHERA", "VOLT"]) if ((pages[5] || []).some((l) => l.replace(/\s/g, "").toUpperCase().includes(n))) luxury.push({ code: n, code15: "T" + n, eur: { 15: 20.9, 50: 60 } });

const list = [...parfums.values()];
for (const p of list) if (!(p.eur[15] < p.eur[30] && p.eur[30] < p.eur[70])) warnings.push(`${p.code} : prix incohérents ${JSON.stringify(p.eur)}`);
const out = process.argv[3] || "src/data/chogan-listino.json";
let previous = {};
try { previous = JSON.parse(fs.readFileSync(out, "utf8")); } catch {}
const result = { edition: previous.edition || "Listino Chogan", eurToFcfa: previous.eurToFcfa || 655.957, markup: previous.markup || 1.25, aliases: previous.aliases || {}, parfums: list, luxury };
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`${list.length} parfums, ${luxury.length} références Luxury → ${out}`);
if (warnings.length) console.log("À vérifier :\n  " + warnings.join("\n  "));
