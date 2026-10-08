/**
 * Moteur de recherche du catalogue (pur, sans base de données) : tolère les accents, les
 * fautes de frappe et l'ordre des mots. Cherche dans le nom, le code Chogan, le numéro de
 * fiche, le parfum d'inspiration et sa marque, la collection, la famille et les notes.
 */

export interface SearchDoc {
  id: string;
  slug: string;
  name: string;
  choganCode: string | null;
  number: number | null;
  inspiredBy: string | null;
  inspiredBrand: string | null;
  category: string;
  categoryLabel: string;
  family: string | null;
  notes: string[];
  /** Description courte et longue (poids faible). */
  description?: string;
  /** Formats vendus (« 70 ml », « Échantillon 3 ml »…). */
  volumes?: string[];
  price: number | null;
  photo: string | null;
  colorFrom: string;
  colorTo: string;
  popularity: number;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9°]+/g, " ")
    .trim();
}

const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "pour", "a", "au", "aux", "un", "une", "parfum", "parfums", "eau", "en"]);

/** Synonymes : un mot de la requête peut aussi valoir ces termes. */
const SYNONYMS: Record<string, string[]> = {
  homme: ["homme", "him", "men", "man", "uomo"],
  hommes: ["homme", "him", "men", "man"],
  femme: ["femme", "her", "woman", "women", "donna"],
  femmes: ["femme", "her", "woman", "women"],
  unisexe: ["unisexe", "unisex", "mixte"],
  mixte: ["mixte", "unisexe", "unisex"],
  gel: ["gel", "douche"],
  douche: ["douche", "gel"],
  creme: ["creme", "lait", "corps"],
  bebe: ["bebe", "baby", "enfant"],
  enfant: ["enfant", "baby", "bebe"],
  cafe: ["cafe", "capsules", "expresso"],
  ysl: ["yves", "saint", "laurent", "ysl"],
  dg: ["dolce", "gabbana"],
  jpg: ["gaultier"],
  mfk: ["kurkdjian"],
};

export function tokenize(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

/** Distance de Damerau-Levenshtein restreinte, arrêtée au-delà de `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

function fuzzyMax(len: number) {
  return len >= 8 ? 2 : len >= 4 ? 1 : 0;
}

export interface Prepared {
  doc: SearchDoc;
  code: string;
  /** Code principal et codes des autres formats (30 ml : 3…, 15 ml : T…). */
  codes: string[];
  desc: string[];
  name: string[];
  inspired: string[];
  brand: string[];
  meta: string[];
  notes: string[];
  nameFull: string;
  inspiredFull: string;
  nameCompact: string;
  inspiredCompact: string;
}

/**
 * Codes de format Chogan : le parfum 001M (70 ml) existe en 301M (30 ml) et T001M (15 ml) ;
 * les codes à 3 chiffres font de même (060 → 360, T060 ; 150M → 3150M, T150M).
 */
export function codeAliases(code: string | null): string[] {
  const c = normalize(code ?? "").replace(/ /g, "");
  if (!c) return [];
  const out = new Set([c]);
  const m = c.match(/^(\d{2,3})([mwub]?)$/);
  if (m) {
    const n = m[1].padStart(3, "0"); // 74M → 074m
    const g = m[2];
    out.add(n + g);
    out.add(`3${n.startsWith("0") ? n.slice(1) : n}${g}`); // 30 ml : 301M, 3150M, 360
    out.add(`t${n}${g}`); // 15 ml : T001M
    if (g) out.add(`t${n}`); // T090 (sans lettre)
  }
  return [...out];
}

function words(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

export function prepare(docs: SearchDoc[]): Prepared[] {
  return docs.map((doc) => {
    const name = normalize(doc.name);
    const inspired = normalize(doc.inspiredBy ?? "");
    return {
      doc,
      code: normalize(doc.choganCode ?? "").replace(/ /g, ""),
      codes: codeAliases(doc.choganCode),
      desc: [...new Set(words(doc.description ?? ""))],
      name: name.split(" ").filter(Boolean),
      inspired: inspired.split(" ").filter(Boolean),
      brand: normalize(doc.inspiredBrand ?? "").split(" ").filter(Boolean),
      meta: [...new Set(words(`${doc.categoryLabel} ${doc.category.replace(/-/g, " ")} ${doc.family ?? ""} ${(doc.volumes ?? []).join(" ")} ml`))],
      notes: normalize(doc.notes.join(" ")).split(" ").filter(Boolean),
      nameFull: name,
      inspiredFull: inspired,
      nameCompact: name.replace(/ /g, ""),
      inspiredCompact: inspired.replace(/ /g, ""),
    };
  });
}

function wordScore(token: string, words: string[], exact: number, prefix: number, fuzzy: number): number {
  let best = 0;
  const max = fuzzyMax(token.length);
  for (const w of words) {
    if (w === token) return exact;
    if (w.startsWith(token)) best = Math.max(best, token.length >= 2 ? prefix : prefix / 2);
    else if (token.length >= 4 && w.includes(token)) best = Math.max(best, prefix * 0.6);
    else if (max && best < fuzzy && editDistance(token, w, max) <= max) best = Math.max(best, fuzzy);
  }
  return best;
}

function tokenScore(t: string, p: Prepared): number {
  const variants = SYNONYMS[t] ?? [t];
  let best = 0;
  for (const v of variants) {
    const syn = v !== t ? 0.85 : 1;
    // Code Chogan (001M, BSF016…) et numéro de fiche
    if (p.code) {
      const bare = v.replace(/^0+/, "");
      if (p.code === v) best = Math.max(best, 120);
      else if (p.codes.includes(v)) best = Math.max(best, 110);
      else if (p.code.startsWith(v) && /\d/.test(v)) best = Math.max(best, 90);
      else if (/^\d+$/.test(v) && p.code.replace(/^0+/, "").startsWith(bare) && bare.length >= 2) best = Math.max(best, 70);
    }
    if (/^\d{3,6}$/.test(v) && p.doc.number === Number(v)) best = Math.max(best, 100);
    best = Math.max(
      best,
      wordScore(v, p.name, 40, 30, 16) * syn,
      wordScore(v, p.inspired, 38, 28, 15) * syn,
      wordScore(v, p.brand, 30, 22, 12) * syn,
      wordScore(v, p.meta, 14, 10, 0) * syn,
      wordScore(v, p.notes, 10, 7, 0) * syn,
      v.length >= 3 ? wordScore(v, p.desc, 6, 4, 0) * syn : 0,
      // Mots collés ou apostrophes : « jadore » pour J'adore, « blackopium »
      v.length >= 4 && p.inspiredCompact.startsWith(v) ? 34 * syn : 0,
      v.length >= 4 && p.nameCompact.startsWith(v) ? 34 * syn : 0,
      v.length >= 5 && p.inspiredCompact.includes(v) ? 22 * syn : 0
    );
  }
  return best;
}

/** Recherche : tous les mots doivent trouver un écho (ET), classement par pertinence puis popularité. */
export function search(index: Prepared[], query: string, limit = 60): { hits: SearchHit[]; total: number } {
  const tokens = tokenize(query);
  if (!tokens.length) return { hits: [], total: 0 };
  const phrase = normalize(query);
  const hits: SearchHit[] = [];
  const whole = phrase.replace(/ /g, "");
  for (const p of index) {
    // Code complet saisi tel quel, même avec tirets ou barres (« INTA001-06 », « LOLSET01-EN/IT/FR »)
    if (whole.length >= 3 && (p.code === whole || p.codes.includes(whole))) {
      hits.push({ doc: p.doc, score: 200 + (p.code === whole ? 20 : 0) });
      continue;
    }
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const s = tokenScore(t, p);
      if (s <= 0) {
        ok = false;
        break;
      }
      score += s;
    }
    if (!ok) continue;
    const compact = phrase.replace(/ /g, "");
    if (compact.length >= 4 && (p.inspiredCompact === compact || p.nameCompact === compact)) score += 30;
    // Bonus d'expression exacte (« black opium », « baccarat rouge »)
    if (tokens.length > 1) {
      if (p.nameFull.includes(phrase)) score += 40;
      if (p.inspiredFull.includes(phrase)) score += 36;
    }
    // À égalité, les parfums passent avant les gels douche et crèmes de la même inspiration.
    const perfume = p.doc.category.startsWith("parfum-") ? 6 : 0;
    hits.push({ doc: p.doc, score: score + perfume + Math.min(p.doc.popularity, 50) / 25 });
  }
  hits.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name, "fr"));
  return { hits: hits.slice(0, limit), total: hits.length };
}

/** « Vouliez-vous dire » : remplace chaque mot inconnu par le mot du catalogue le plus proche. */
export function suggest(index: Prepared[], query: string): string | null {
  const tokens = tokenize(query);
  if (!tokens.length) return null;
  const vocab = new Map<string, number>();
  for (const p of index) for (const w of [...p.name, ...p.inspired, ...p.brand]) if (w.length >= 3) vocab.set(w, (vocab.get(w) ?? 0) + 1);
  let changed = false;
  const out = tokens.map((t) => {
    if (vocab.has(t)) return t;
    let best: string | null = null;
    let bestD = 3;
    let bestF = 0;
    for (const [w, f] of vocab) {
      if (Math.abs(w.length - t.length) > 2) continue;
      const d = editDistance(t, w, 2);
      if (d < bestD || (d === bestD && f > bestF)) {
        best = w;
        bestD = d;
        bestF = f;
      }
    }
    if (best && bestD <= 2) {
      changed = true;
      return best;
    }
    return t;
  });
  return changed ? out.join(" ") : null;
}

/** Marques d'inspiration présentes dans les résultats, avec leur nombre. */
export function brandFacets(hits: SearchHit[]) {
  const m = new Map<string, number>();
  for (const h of hits) if (h.doc.inspiredBrand) m.set(h.doc.inspiredBrand, (m.get(h.doc.inspiredBrand) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([brand, count]) => ({ brand, count }));
}

export function categoryFacets(hits: SearchHit[]) {
  const m = new Map<string, { label: string; count: number }>();
  for (const h of hits) {
    const c = m.get(h.doc.category) ?? { label: h.doc.categoryLabel, count: 0 };
    c.count += 1;
    m.set(h.doc.category, c);
  }
  return [...m.entries()].sort((a, b) => b[1].count - a[1].count).map(([slug, v]) => ({ slug, ...v }));
}
