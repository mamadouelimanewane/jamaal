/**
 * « Parfum ADN » : profil olfactif du client et parfums Chogan les plus proches, avec un pourcentage de
 * correspondance et la raison. Pur et testé (aucun accès réseau ni base).
 *
 * Le client cite les parfums qu'il porte déjà (« Sauvage », « J'adore ») et répond à quelques questions.
 * 1. Un parfum Chogan inspiré d'un parfum cité = correspondance directe (≈ 98 %).
 * 2. Sinon, on compare familles et notes : celles des parfums cités (base de référence ci-dessous, ou
 *    fiche Chogan inspirée de ce parfum) et celles des familles choisies.
 */

export type Gender = "femme" | "homme" | "unisexe";
export type Family = "frais" | "floral" | "boise" | "oriental" | "gourmand";
export type Intensity = "discret" | "modere" | "intense";
export type Moment = "jour" | "soir" | "tous";

export type AdnAnswers = { worn: string[]; gender: Gender | null; families: Family[]; intensity: Intensity | null; moment: Moment | null };

export type ScentProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  inspiredBy?: string | null;
  inspiredBrand?: string | null;
  family?: string | null;
  topNotes?: string[];
  heartNotes?: string[];
  baseNotes?: string[];
  price?: number | null;
  photo?: string | null;
};

export type AdnMatch = { product: ScentProduct; percent: number; reason: string; direct: boolean };

export const FAMILY_LABELS: Record<Family, string> = { frais: "Frais, agrumes, marin", floral: "Floral, poudré", boise: "Boisé", oriental: "Oriental, épicé, ambré, oud", gourmand: "Gourmand, vanillé" };

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Mots-clés de chaque famille (notes, descriptions). */
export const FAMILY_WORDS: Record<Family, string[]> = {
  frais: ["frais", "agrume", "citrus", "marin", "aquatique", "bergamote", "citron", "menthe", "pamplemousse", "mandarine", "neroli", "lavande", "the vert", "ozonique", "gingembre"],
  floral: ["floral", "rose", "jasmin", "fleur", "poudre", "iris", "pivoine", "tubereuse", "fleur d oranger", "violette", "ylang", "muguet", "magnolia", "freesia"],
  boise: ["bois", "boise", "cedre", "vetiver", "santal", "patchouli", "mousse", "cuir", "cachemire", "gaiac", "bouleau"],
  oriental: ["oriental", "ambre", "ambre gris", "epice", "encens", "oud", "musc", "poivre", "safran", "cannelle", "cardamome", "myrrhe", "labdanum", "ambroxan"],
  gourmand: ["vanille", "sucre", "gourmand", "caramel", "tonka", "praline", "cacao", "cafe", "miel", "chocolat", "amande", "noix de coco", "fruits rouges"],
};

type Ref = { names: string[]; gender: Gender; families: Family[]; notes: string[] };

/** Parfums de grande marque souvent portés au Sénégal : famille et notes principales. */
export const REFERENCE: Ref[] = [
  { names: ["sauvage", "dior sauvage"], gender: "homme", families: ["frais", "oriental"], notes: ["bergamote", "poivre", "lavande", "ambroxan", "vetiver"] },
  { names: ["bleu de chanel", "bleu chanel"], gender: "homme", families: ["boise", "frais"], notes: ["pamplemousse", "menthe", "gingembre", "cedre", "santal", "encens"] },
  { names: ["acqua di gio", "acqua di gio armani"], gender: "homme", families: ["frais"], notes: ["bergamote", "marin", "neroli", "romarin", "patchouli", "musc"] },
  { names: ["one million", "1 million", "1million"], gender: "homme", families: ["oriental", "gourmand"], notes: ["mandarine", "cannelle", "rose", "cuir", "ambre"] },
  { names: ["invictus"], gender: "homme", families: ["frais", "boise"], notes: ["pamplemousse", "marin", "laurier", "gaiac", "ambre gris"] },
  { names: ["le male", "le male gaultier"], gender: "homme", families: ["oriental", "gourmand"], notes: ["lavande", "menthe", "vanille", "tonka", "cannelle"] },
  { names: ["eros", "eros versace"], gender: "homme", families: ["frais", "gourmand"], notes: ["menthe", "pomme", "tonka", "vanille", "cedre"] },
  { names: ["aventus", "creed aventus"], gender: "homme", families: ["boise", "frais"], notes: ["ananas", "bergamote", "bouleau", "patchouli", "musc"] },
  { names: ["boss bottled", "hugo boss bottled"], gender: "homme", families: ["boise"], notes: ["pomme", "cannelle", "santal", "cedre", "vetiver"] },
  { names: ["terre d hermes"], gender: "homme", families: ["boise", "frais"], notes: ["orange", "pamplemousse", "poivre", "vetiver", "cedre"] },
  { names: ["light blue", "light blue dolce"], gender: "unisexe", families: ["frais"], notes: ["citron", "pomme", "jasmin", "cedre", "musc"] },
  { names: ["j adore", "jadore"], gender: "femme", families: ["floral"], notes: ["ylang", "rose", "jasmin", "tubereuse", "musc"] },
  { names: ["la vie est belle"], gender: "femme", families: ["gourmand", "floral"], notes: ["iris", "praline", "vanille", "patchouli", "fruits rouges"] },
  { names: ["black opium"], gender: "femme", families: ["gourmand", "oriental"], notes: ["cafe", "vanille", "fleur d oranger", "jasmin", "cedre"] },
  { names: ["coco mademoiselle", "coco chanel"], gender: "femme", families: ["floral", "oriental"], notes: ["orange", "rose", "jasmin", "patchouli", "vetiver"] },
  { names: ["chanel n 5", "chanel numero 5", "n 5", "no 5"], gender: "femme", families: ["floral"], notes: ["aldehydes", "ylang", "rose", "jasmin", "santal", "vanille"] },
  { names: ["good girl", "carolina herrera good girl"], gender: "femme", families: ["gourmand", "floral"], notes: ["amande", "cafe", "tubereuse", "jasmin", "cacao", "tonka"] },
  { names: ["libre", "libre ysl"], gender: "femme", families: ["floral", "oriental"], notes: ["lavande", "mandarine", "fleur d oranger", "vanille", "ambre gris"] },
  { names: ["si armani", "si"], gender: "femme", families: ["gourmand", "floral"], notes: ["cassis", "rose", "vanille", "patchouli", "ambre"] },
  { names: ["alien", "alien mugler"], gender: "femme", families: ["oriental", "floral"], notes: ["jasmin", "bois", "ambre"] },
  { names: ["miss dior"], gender: "femme", families: ["floral"], notes: ["rose", "pivoine", "iris", "musc"] },
  { names: ["flowerbomb"], gender: "femme", families: ["floral", "gourmand"], notes: ["the", "jasmin", "rose", "orchidee", "patchouli", "musc"] },
  { names: ["scandal", "scandal gaultier"], gender: "femme", families: ["gourmand", "floral"], notes: ["miel", "fleur d oranger", "gardenia", "patchouli"] },
  { names: ["baccarat rouge", "baccarat rouge 540", "br540"], gender: "unisexe", families: ["oriental", "boise"], notes: ["safran", "jasmin", "ambre gris", "cedre", "resine"] },
  { names: ["oud wood", "tom ford oud"], gender: "unisexe", families: ["oriental", "boise"], notes: ["oud", "santal", "vetiver", "cardamome", "tonka"] },
  { names: ["tobacco vanille"], gender: "unisexe", families: ["gourmand", "oriental"], notes: ["tabac", "vanille", "cacao", "fruits secs", "epices"] },
  { names: ["lost cherry"], gender: "unisexe", families: ["gourmand"], notes: ["cerise", "amande", "liqueur", "tonka", "santal"] },
  { names: ["ombre nomade", "louis vuitton ombre nomade"], gender: "unisexe", families: ["oriental", "boise"], notes: ["oud", "encens", "framboise", "benjoin", "bouleau"] },
  { names: ["santal 33", "le labo santal"], gender: "unisexe", families: ["boise"], notes: ["santal", "cedre", "cuir", "iris", "violette"] },
  { names: ["fucking fabulous"], gender: "unisexe", families: ["oriental", "boise"], notes: ["lavande", "sauge", "cuir", "tonka", "cachemire"] },
];

function productNotes(p: ScentProduct): string[] {
  return [...(p.topNotes ?? []), ...(p.heartNotes ?? []), ...(p.baseNotes ?? [])].map(norm).filter(Boolean);
}
function productText(p: ScentProduct): string {
  return norm([p.name, p.family, p.inspiredBy, ...(p.topNotes ?? []), ...(p.heartNotes ?? []), ...(p.baseNotes ?? [])].filter(Boolean).join(" "));
}
const productFamilies = (p: ScentProduct): Family[] => {
  const t = productText(p);
  return (Object.keys(FAMILY_WORDS) as Family[]).filter((f) => FAMILY_WORDS[f].some((w) => t.includes(w)));
};
const genderOf = (p: ScentProduct): Gender | null => (p.category.includes("homme") ? "homme" : p.category.includes("femme") ? "femme" : p.category.includes("unisexe") ? "unisexe" : null);

/** Parfum cité ↔ texte : même nom, en tolérant « Dior Sauvage » / « sauvage dior ». */
function sameScent(worn: string, other: string | null | undefined): boolean {
  const a = norm(worn);
  const b = norm(other ?? "");
  if (a.length < 2 || b.length < 2) return false;
  if (a === b) return true;
  const long = a.length >= b.length ? a : b;
  const short = a.length >= b.length ? b : a;
  return short.length >= 4 && new RegExp(`(^| )${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(long);
}

export function findReference(worn: string): Ref | null {
  return REFERENCE.find((r) => r.names.some((n) => sameScent(worn, n))) ?? null;
}

export type AdnProfile = { families: Family[]; notes: string[]; gender: Gender | null; worn: string[]; recognised: string[] };

/** Profil olfactif : familles et notes, à partir des parfums cités, des fiches inspirées et des réponses. */
export function buildProfile(a: AdnAnswers, catalog: ScentProduct[]): AdnProfile {
  const famCount = new Map<Family, number>();
  const notes = new Map<string, number>();
  const recognised: string[] = [];
  const genders: Gender[] = [];
  for (const w of a.worn) {
    const ref = findReference(w);
    const twin = catalog.find((p) => sameScent(w, p.inspiredBy));
    if (ref) {
      recognised.push(w);
      genders.push(ref.gender);
      ref.families.forEach((f, i) => famCount.set(f, (famCount.get(f) ?? 0) + (i === 0 ? 2 : 1)));
      ref.notes.forEach((n) => notes.set(norm(n), (notes.get(norm(n)) ?? 0) + 1));
    }
    if (twin) {
      if (!ref) recognised.push(w);
      productFamilies(twin).forEach((f) => famCount.set(f, (famCount.get(f) ?? 0) + 1));
      productNotes(twin).forEach((n) => notes.set(n, (notes.get(n) ?? 0) + 1));
      const g = genderOf(twin);
      if (g) genders.push(g);
    }
  }
  for (const f of a.families) famCount.set(f, (famCount.get(f) ?? 0) + 2);
  const families = [...famCount.entries()].sort((x, y) => y[1] - x[1]).map(([f]) => f).slice(0, 3);
  const gender = a.gender ?? (genders.length && genders.every((g) => g === genders[0]) ? genders[0] : null);
  return { families, notes: [...notes.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n).slice(0, 12), gender, worn: a.worn, recognised };
}

const HEAVY = ["oud", "ambre", "encens", "cuir", "patchouli", "vanille", "tonka", "safran", "musc"];
const LIGHT = ["agrume", "bergamote", "citron", "marin", "aquatique", "menthe", "the", "neroli", "pamplemousse"];

/** Les 3 parfums (ou plus) les plus proches du profil, du meilleur au moins bon. */
export function matchScents(a: AdnAnswers, catalog: ScentProduct[], limit = 3): { profile: AdnProfile; matches: AdnMatch[] } {
  const profile = buildProfile(a, catalog);
  const perfumes = catalog.filter((p) => p.category.startsWith("parfum"));
  const scored = perfumes.map((p) => {
    const g = genderOf(p);
    const text = productText(p);
    const pNotes = productNotes(p);
    const direct = a.worn.find((w) => sameScent(w, p.inspiredBy));
    let score = 0;
    const why: string[] = [];
    if (direct) {
      score += 100;
      why.push(`inspiré de ${p.inspiredBy}${p.inspiredBrand ? ` (${p.inspiredBrand})` : ""}, que vous portez`);
    }
    const commonFam = profile.families.filter((f) => productFamilies(p).includes(f));
    score += commonFam.reduce((s, f) => s + (f === profile.families[0] ? 14 : 8), 0);
    const commonNotes = profile.notes.filter((n) => pNotes.some((pn) => pn.includes(n) || n.includes(pn)) || text.includes(n));
    score += Math.min(30, commonNotes.length * 7);
    if (profile.gender && g) {
      if (g === profile.gender) score += 10;
      else if (g === "unisexe" || profile.gender === "unisexe") score += 4;
      else score -= 40;
    }
    if (a.intensity === "intense" || a.moment === "soir") score += HEAVY.some((w) => text.includes(w)) ? 6 : 0;
    if (a.intensity === "discret" || a.moment === "jour") score += LIGHT.some((w) => text.includes(w)) ? 6 : 0;
    if (!direct) {
      if (commonFam.length) why.push(`famille ${commonFam.map((f) => FAMILY_LABELS[f].split(",")[0].toLowerCase()).join(" et ")}`);
      if (commonNotes.length) why.push(`notes de ${commonNotes.slice(0, 3).join(", ")}`);
      const sameFamilyAs = profile.recognised.find((w) => {
        const ref = findReference(w);
        return ref && ref.families.some((f) => commonFam.includes(f));
      });
      if (sameFamilyAs && commonFam.length) why.unshift(`dans l'esprit de ${sameFamilyAs}`);
    }
    return { p, score, direct: !!direct, why };
  });
  const best = Math.max(1, ...scored.filter((s) => !s.direct).map((s) => s.score));
  const matches = scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score || x.p.name.localeCompare(y.p.name, "fr"))
    .slice(0, limit)
    .map((s) => ({
      product: s.p,
      direct: s.direct,
      percent: s.direct ? 98 : Math.max(55, Math.min(95, Math.round(60 + (35 * s.score) / best))),
      reason: s.why.length ? s.why.join(" · ") : "un classique très apprécié",
    }));
  return { profile, matches };
}

export function parseAdnAnswers(raw: Record<string, unknown>): AdnAnswers {
  const worn = (Array.isArray(raw.worn) ? raw.worn : String(raw.worn ?? "").split(/[,;\n]/))
    .map((w) => String(w).trim().slice(0, 60))
    .filter((w) => w.length >= 2)
    .slice(0, 5);
  const gender = ["femme", "homme", "unisexe"].includes(String(raw.gender)) ? (raw.gender as Gender) : null;
  const families = (Array.isArray(raw.families) ? raw.families : []).map(String).filter((f): f is Family => f in FAMILY_WORDS).slice(0, 3);
  const intensity = ["discret", "modere", "intense"].includes(String(raw.intensity)) ? (raw.intensity as Intensity) : null;
  const moment = ["jour", "soir", "tous"].includes(String(raw.moment)) ? (raw.moment as Moment) : null;
  return { worn, gender, families, intensity, moment };
}

/** Résumé lisible du profil (relances, conseils, fiche client). */
export function profileSummary(p: Pick<AdnProfile, "families" | "notes" | "worn">): string {
  const fam = p.families.map((f) => FAMILY_LABELS[f].split(",")[0].toLowerCase()).join(", ");
  return [fam && `aime le ${fam}`, p.notes.length ? `notes ${p.notes.slice(0, 4).join(", ")}` : "", p.worn.length ? `porte ${p.worn.join(", ")}` : ""].filter(Boolean).join(" ; ");
}
