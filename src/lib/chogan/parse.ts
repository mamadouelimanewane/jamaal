/**
 * Lecture des pages publiques du site Chogan (chogangroupspa.com) pour l'import de produits.
 * Chogan n'offre pas d'API : on lit le HTML des fiches (productDetail/<n°>) et des résultats de
 * recherche (productList?search=…). Tout ce fichier est pur (aucun accès réseau ni base) et
 * testé sur des pages réelles enregistrées (src/lib/__tests__/fixtures/chogan). Si Chogan change
 * la structure de ses pages, les fonctions renvoient null / [] plutôt qu'une fiche fausse.
 */
import { cleanNote, familyOf } from "../../../scripts/import-chogan-notes.mjs";

/** Parité fixe franc CFA / euro. */
export const EUR_TO_FCFA = 655.957;
export const eurToFcfa = (eur: number) => Math.round(eur * EUR_TO_FCFA);

export type ChoganNotes = { top: string[]; heart: string[]; base: string[]; family: string | null };

export type ChoganDetail = {
  number: number;
  code: string;
  name: string;
  shade: string | null;
  format: string | null;
  publicPriceEur: number | null;
  images: string[];
  breadcrumb: string[];
  brand: string | null;
  description: string[];
  notes: ChoganNotes | null;
  /** Autres teintes de la même gamme (pastilles de couleur), fiche courante comprise. */
  shades: { number: number; code: string }[];
  /** Formats proposés (50 ml, 15 ml…), chacun étant sa propre fiche Chogan. */
  formats: { number: number; label: string; priceEur: number | null }[];
};

export type ChoganCard = {
  number: number;
  code: string;
  name: string;
  format: string | null;
  priceEur: number | null;
  image: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê",
  euml: "ë", agrave: "à", acirc: "â", auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï", ocirc: "ô", ouml: "ö",
  ucirc: "û", ugrave: "ù", uuml: "ü", oelig: "œ", OElig: "Œ", aelig: "æ", Eacute: "É", Egrave: "È",
  Agrave: "À", Ccedil: "Ç", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  ndash: "–", mdash: "—", hellip: "…", deg: "°", trade: "™", reg: "®", copy: "©", euro: "€", middot: "·",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** Texte lisible d'un fragment HTML : balises retirées, entités décodées, espaces resserrés. */
export function htmlText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** « 19,90 € », « 19.9 », « € 4,00 » → 19.9 ; null si illisible. */
export function parsePriceEur(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.replace(/\s/g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** « 50 mL » → « 50 ml », « 7 g » inchangé. */
export const normalizeFormat = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\bmL\b/g, "ml");

const between = (html: string, start: string, end: string): string | null => {
  const a = html.indexOf(start);
  if (a < 0) return null;
  const b = html.indexOf(end, a + start.length);
  return b < 0 ? null : html.slice(a + start.length, b);
};

/** Les pages réelles sont indentées : on resserre les espaces pour des motifs stables. */
const squash = (html: string) => html.replace(/\s+/g, " ");

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

function parseNotes(descHtml: string): ChoganNotes | null {
  const items = [...descHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => htmlText(m[1]));
  const pick = (re: RegExp) => {
    const line = items.find((l) => re.test(l));
    if (!line) return [];
    return line
      .replace(/^[^:]*:\s*/, "")
      .split(",")
      .map((n) => cleanNote(n))
      .filter(Boolean);
  };
  const top = pick(/^notes? de t[êe]te/i);
  const heart = pick(/^notes? de c(œ|oe)ur/i);
  const base = pick(/^notes? de fond/i);
  if (!top.length && !heart.length && !base.length) return null;
  return { top, heart, base, family: familyOf(top, heart, base) ?? null };
}

function parseDescription(descHtml: string): string[] {
  const firstP = descHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
  return firstP
    .split(/<br\s*\/?>/i)
    .map((l) => htmlText(l))
    .filter((l) => l && !/^CPNP\b/i.test(l) && !/^(teinte|couleur|colore|colour)\s*:/i.test(l));
}

/** Fiche produit Chogan (page productDetail/<n°>). null si la page n'a pas la structure attendue. */
export function parseProductDetail(page: string): ChoganDetail | null {
  const html = squash(page);
  const number = Number(html.match(/id="id_art"\s+value="(\d+)"/)?.[1] ?? html.match(/name="id_art"[^>]*value="(\d+)"/)?.[1]);
  const codeBlock = between(html, 'id="code-container"', "</div>") ?? "";
  const code = htmlText(codeBlock.match(/Cod\.\s*<span[^>]*>([^<]+)<\/span>/)?.[1] ?? "");
  const caption = between(html, 'class="caption-product"', "</div>") ?? "";
  const name = htmlText(caption.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  if (!Number.isFinite(number) || number <= 0 || !code || !name) return null;

  const subtitle = htmlText(caption.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
  const parts = subtitle.split("|").map((p) => p.trim()).filter(Boolean);
  const shadeInCode = htmlText(codeBlock.match(/data-target="#allColorsModal"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
  const format = parts[0] ? normalizeFormat(parts[0]) : null;

  const publicPriceEur =
    parsePriceEur(html.match(/value="([\d.,]+)"\s+id="prezzo_pubblico"/)?.[1]) ??
    parsePriceEur(between(html, 'class="calculator"', "</h1>"));

  const gallery = between(html, 'id="big-carousel"', 'id="scrollable-div"') ?? between(html, 'id="gal_prod"', 'id="mod_acquisto"') ?? "";
  const images = uniq([...gallery.matchAll(/data-image="(https:\/\/[^"]+)"/g)].map((m) => m[1]));

  const bc = between(html, 'id="olBreadcrumb"', "</ol>") ?? "";
  const breadcrumb = [...bc.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map((m) => htmlText(m[1])).filter(Boolean);

  const brand = html.match(/img\/logos\/([a-z0-9_-]+)\.svg/i)?.[1] ?? null;

  const colors = between(html, 'id="colors"', "</ul>") ?? "";
  const shades = [...colors.matchAll(/productDetail\/(\d+)"[^>]*?title="([^"]+)"/g)].map((m) => ({ number: Number(m[1]), code: htmlText(m[2]) }));
  // Une teinte n'existe que sur les fiches à nuancier : ailleurs, la 2e partie du sous-titre est une
  // mention (« Essence 30 % ») ou le nom répété.
  const shade = shadeInCode || (shades.length && parts[1] ? parts[1] : null);

  const fmt = between(html, 'class="formats-group"', "</div> </div>") ?? between(html, 'class="formats-group"', 'id="colors"') ?? "";
  const formats = [...fmt.matchAll(/productDetail\/(\d+)"[^>]*>\s*([^<]+?)\s*<br\s*\/?>\s*([^<]*)<\/a>/g)].map((m) => ({
    number: Number(m[1]),
    label: normalizeFormat(htmlText(m[2])),
    priceEur: parsePriceEur(m[3]),
  }));

  const descHtml = between(html, 'id="fulldesc">', "id='pricing2'") ?? between(html, 'id="fulldesc">', 'class="d-none body-full') ?? "";

  return {
    number,
    code,
    name,
    shade,
    format,
    publicPriceEur,
    images,
    breadcrumb,
    brand,
    description: parseDescription(descHtml),
    notes: parseNotes(descHtml),
    shades,
    formats,
  };
}

/** Cartes produit d'une page de résultats (recherche ou rubrique). */
export function parseSearchResults(page: string): ChoganCard[] {
  const chunks = squash(page).split(/id="card_key___\d+"/).slice(1);
  const cards: ChoganCard[] = [];
  for (const c of chunks) {
    const number = Number(c.match(/productDetail\/(\d+)/)?.[1]);
    const code = htmlText(c.match(/id="product_code_key___\d+"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    const name = htmlText(c.match(/id="product_description_key___\d+"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
    if (!Number.isFinite(number) || number <= 0 || !code || !name) continue;
    const format = htmlText(c.match(/id="product_formato_key___\d+"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "") || null;
    const priceEur = parsePriceEur(c.match(/class="product_price_key___\d+[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const image = c.match(/background-image:\s*url\('(https:\/\/[^']+)'\)/)?.[1] ?? null;
    if (!cards.some((x) => x.number === number)) cards.push({ number, code, name, format: format ? normalizeFormat(format) : null, priceEur, image });
  }
  return cards;
}

export { classifyQuery, splitBatch, type ChoganQuery } from "./query";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Classe les cartes d'une recherche par nom : un code identique en premier, puis le nombre de
 * mots de la saisie retrouvés dans le nom, le code ou le nom du fichier photo (qui porte souvent la
 * teinte : « …MM041-PEACH.jpg »).
 */
export function rankCards(text: string, cards: ChoganCard[]): ChoganCard[] {
  const words = fold(text).split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const q = fold(text).replace(/\s+/g, "");
  const score = (c: ChoganCard) => {
    if (fold(c.code) === q) return 1000;
    const hay = fold(`${c.name} ${c.code} ${c.format ?? ""} ${(c.image ?? "").split("/").pop() ?? ""}`);
    return words.filter((w) => hay.includes(w)).length;
  };
  return cards.map((c, i) => ({ c, s: score(c), i })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c);
}

/** Catégorie JAMAAL proposée d'après le fil d'Ariane Chogan, le nom et le code. */
export function suggestCategory(breadcrumb: string[], name: string, code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith("BSF")) return "gels-douche";
  if (c.startsWith("CRF")) return "cremes-corps";
  if (c.startsWith("COP")) return "parfum-ambiance";
  if (c.startsWith("LO")) return "lolum";
  if (c.startsWith("MM")) return "maquillage";
  if (c.startsWith("BH")) return "entretien-maison";
  if (c.startsWith("CAP") || c.startsWith("SHM")) return "soins-cheveux";
  if (c.startsWith("SOL")) return "soleil";
  const bc = fold(breadcrumb.join(" > "));
  const n = fold(name);
  const has = (s: string, ...ws: string[]) => ws.some((w) => s.includes(w));
  if (has(bc, "lolum")) return "lolum";
  if (has(bc, "aurodhea")) return "aurodhea";
  if (has(bc, "maquillage", "make up", "make-up")) return "maquillage";
  if (has(bc, "solaire", "soleil")) return "soleil";
  if (has(bc, "cheveux")) return "soins-cheveux";
  if (has(bc, "ambiance", "bougie")) return "parfum-ambiance";
  if (has(bc, "maison", "nettoy", "entretien", "lessive")) return "entretien-maison";
  if (has(bc, "animaux")) return "animaux";
  if (has(bc, "cafe", "boisson", "infusion")) return "cafe-boissons";
  if (has(bc, "substitut")) return "substituts-repas";
  if (has(bc, "sport")) return "nutrition-sport";
  if (has(bc, "complement", "nutrition", "bien-etre", "bien etre")) return "complement-alimentaire";
  if (has(bc, "bijou")) return "bijoux";
  if (has(bc, "etui")) return "etuis-parfum";
  if (has(bc, "visage")) return "soins-visage";
  if (has(bc, "corps", "bain", "douche")) return "soins-corps";
  if (has(bc, "parfum") || has(n, "parfum")) {
    if (has(n, "homme", "pour lui", "for him")) return "parfum-homme";
    if (has(n, "femme", "pour elle", "for her")) return "parfum-femme";
    return "parfum-unisexe";
  }
  if (has(n, "dentifrice", "savon", "gel douche", "creme")) return "soins-corps";
  return "autres-produits";
}
