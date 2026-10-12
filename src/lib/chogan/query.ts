/**
 * Ce que l'administrateur saisit dans l'import Chogan : lien, n° de fiche, code ou nom.
 * Pur et sans dépendance serveur : utilisable aussi dans le navigateur (aperçu de la saisie).
 */
export type ChoganQuery =
  | { kind: "number"; number: number; raw: string }
  | { kind: "code"; code: string; raw: string }
  | { kind: "name"; text: string; raw: string };

/**
 * Un lien ou un n° de fiche (4 chiffres et plus, « n° 9479 »), un code Chogan (un seul mot
 * contenant un chiffre : MM041, 001M, BSF016, 060) ou un nom. Un mot sans chiffre (« Amphera »)
 * est traité comme un nom : la recherche Chogan le trouve aussi quand c'est un code.
 */
export function classifyQuery(raw: string): ChoganQuery | null {
  const s = raw.trim();
  if (!s) return null;
  const url = s.match(/productDetail\/(\d+)/i);
  if (url) return { kind: "number", number: Number(url[1]), raw: s };
  const n = s.match(/^(?:n°|n\.|no|n|#|fiche)\s*(\d{3,7})$/i) ?? s.match(/^(\d{4,7})$/);
  if (n) return { kind: "number", number: Number(n[1]), raw: s };
  if (/^[a-z0-9][a-z0-9._-]{0,19}$/i.test(s) && /\d/.test(s)) return { kind: "code", code: s.toUpperCase(), raw: s };
  return { kind: "name", text: s.replace(/\s+/g, " "), raw: s };
}

const looksLikeCodeOrNumber = (t: string) => {
  const q = classifyQuery(t);
  return !!q && q.kind !== "name";
};

/**
 * Une saisie par lots → liste de requêtes (50 au plus, sans doublon). Une ligne = une requête ;
 * une ligne qui ne contient que des codes ou des n° séparés par des espaces, virgules ou
 * points-virgules (« MM041, MM042 9474 ») en donne plusieurs.
 */
export function splitBatch(text: string, max = 50): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const parts = l.split(/[\s,;]+/).filter(Boolean);
    if (parts.length > 1 && !/productDetail/i.test(l) && parts.every(looksLikeCodeOrNumber)) out.push(...parts);
    else out.push(l.replace(/^[-*•]\s*/, ""));
  }
  const seen = new Set<string>();
  return out
    .filter((q) => {
      const k = q.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}
