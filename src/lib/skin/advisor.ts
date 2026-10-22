/**
 * Skin Advisor JAMAAL : questionnaire, choix des soins dans le catalogue et routine personnalisée.
 * Pur et testé (aucun accès réseau ni base). L'analyse de la photo (IA) est dans l'action serveur ;
 * ce module fournit le prompt, la validation de la réponse et la routine de secours sans IA.
 *
 * Pensé d'abord pour les peaux noires et métissées (phototypes IV à VI) : taches et marques
 * post-inflammatoires, teint irrégulier, peau terne ou « grise » par déshydratation, brillance,
 * poils incarnés ; jamais de produit éclaircissant ou dépigmentant.
 */

export type SkinType = "grasse" | "seche" | "mixte" | "normale" | "sensible";
export type Concern = "taches" | "boutons" | "terne" | "deshydratation" | "rides" | "pores" | "cernes" | "poils" | "sensibilite";

export const SKIN_TYPES: { id: SkinType; label: string; hint: string }[] = [
  { id: "grasse", label: "Grasse", hint: "Brille sur tout le visage en journée" },
  { id: "mixte", label: "Mixte", hint: "Brille sur le front et le nez, normale ailleurs" },
  { id: "normale", label: "Normale", hint: "Ni tiraillements ni brillance" },
  { id: "seche", label: "Sèche", hint: "Tiraille, aspect terne ou « gris » par endroits" },
  { id: "sensible", label: "Sensible", hint: "Picote ou réagit facilement aux produits" },
];

export const CONCERNS: { id: Concern; label: string }[] = [
  { id: "taches", label: "Taches, marques de boutons, teint irrégulier" },
  { id: "boutons", label: "Boutons, imperfections" },
  { id: "terne", label: "Teint terne, manque d'éclat" },
  { id: "deshydratation", label: "Déshydratation, peau qui tiraille" },
  { id: "pores", label: "Pores visibles, brillance" },
  { id: "rides", label: "Rides, perte de fermeté" },
  { id: "cernes", label: "Cernes, poches" },
  { id: "poils", label: "Poils incarnés, irritation du rasage" },
  { id: "sensibilite", label: "Rougeurs, sensations d'inconfort" },
];

export type Answers = { skinType: SkinType | null; concerns: Concern[]; sun: "souvent" | "parfois" | "rarement" | null; age: "moins25" | "25-40" | "40plus" | null };

export function parseAnswers(raw: Record<string, unknown>): Answers {
  const skinType = SKIN_TYPES.some((t) => t.id === raw.skinType) ? (raw.skinType as SkinType) : null;
  const list = Array.isArray(raw.concerns) ? raw.concerns : typeof raw.concerns === "string" ? raw.concerns.split(",") : [];
  const concerns = [...new Set(list.map(String).filter((c): c is Concern => CONCERNS.some((k) => k.id === c)))].slice(0, 5);
  const sun = ["souvent", "parfois", "rarement"].includes(String(raw.sun)) ? (raw.sun as Answers["sun"]) : null;
  const age = ["moins25", "25-40", "40plus"].includes(String(raw.age)) ? (raw.age as Answers["age"]) : null;
  return { skinType, concerns, sun, age };
}

/** Produit du catalogue tel que vu par le Skin Advisor. */
export type CatalogItem = { id: string; slug: string; name: string; category: string; categoryLabel?: string | null; shortDescription?: string | null; price?: number | null; photo?: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SKIN_WORDS = /(visage|creme|serum|nettoyant visage|demaquill|micellaire|tonique|lotion tonique|contour|yeux|masque|gommage|exfoli|spf|solaire|aurodhea|hydrat|anti.?(rides|age|taches)|eclat|peau|soin)/;
const NOT_SKIN = /(parfum|eau de|douche|shampo|cheveu|capillaire|dentifrice|bouche|lessive|vaisselle|sol |sols|maison|cafe|capsule|complement|nutrition|minceur|desodor|deodor|bougie|diffuseur|voiture|textile|chien|chat)/;

/** Soin du visage (ou de la peau) proposable dans une routine ? */
export function isSkincare(p: Pick<CatalogItem, "name" | "category" | "categoryLabel" | "shortDescription">): boolean {
  const cat = norm(`${p.category} ${p.categoryLabel ?? ""}`);
  if (/parfum|maison|entretien|nutrition|cafe|complement|bien-etre-interieur/.test(cat)) return false;
  const text = norm(`${p.name} ${p.categoryLabel ?? ""} ${p.category} ${p.shortDescription ?? ""}`);
  return SKIN_WORDS.test(text) && !NOT_SKIN.test(norm(p.name));
}

export type StepId = "nettoyant" | "tonique" | "serum" | "jour" | "nuit" | "contour" | "masque";
export const STEP_LABELS: Record<StepId, string> = {
  nettoyant: "Nettoyer",
  tonique: "Tonifier",
  serum: "Traiter (sérum)",
  jour: "Hydrater et protéger (SPF)",
  nuit: "Réparer la nuit",
  contour: "Contour des yeux",
  masque: "Masque ou gommage (1 à 2 fois par semaine)",
};
const STEP_WORDS: Record<StepId, RegExp> = {
  nettoyant: /(nettoyant|gel lavant|mousse|demaquill|micellaire|cleans|lait demaq)/,
  tonique: /(tonique|toner|lotion(?! corps))/,
  serum: /(serum|concentre|ampoule|booster|elixir|huile visage)/,
  jour: /(spf|solaire|jour|day|fluide|emulsion|creme visage|creme hydratante)/,
  nuit: /(nuit|night|regener|repar)/,
  contour: /(contour|yeux|eye)/,
  masque: /(masque|gommage|exfoli|scrub|peeling)/,
};
const CONCERN_WORDS: Record<Concern, RegExp> = {
  taches: /(eclat|tache|vitamine c|uniform|niacin|pigment|lumin|unifi)/,
  boutons: /(purif|matif|acne|imperfection|neem|tea tree|arbre a the|zinc|salicyl)/,
  terne: /(eclat|vitamine|lumin|glow|radiance)/,
  deshydratation: /(hydrat|hyaluron|aloe|nourri|karite|beurre|riche)/,
  pores: /(pores|purif|matif|argile)/,
  rides: /(rides|anti.?age|lift|collag|retinol|ferm|jeunesse)/,
  cernes: /(contour|yeux|cerne|poche)/,
  poils: /(apaisant|apres.?rasage|aloe|calm)/,
  sensibilite: /(apaisant|sensible|calm|aloe|douceur|camomille)/,
};
const TYPE_WORDS: Record<SkinType, RegExp> = {
  grasse: /(matif|purif|leger|legere|gel|oil.?free)/,
  mixte: /(equilibr|matif|leger|gel)/,
  normale: /(hydrat|equilibr)/,
  seche: /(nourri|riche|karite|beurre|hydrat|confort)/,
  sensible: /(apaisant|sensible|douceur|calm)/,
};

function score(p: CatalogItem, step: StepId, a: Answers): number {
  const t = norm(`${p.name} ${p.shortDescription ?? ""}`);
  if (!STEP_WORDS[step].test(norm(p.name)) && !STEP_WORDS[step].test(t)) return 0;
  let s = STEP_WORDS[step].test(norm(p.name)) ? 10 : 5;
  for (const c of a.concerns) if (CONCERN_WORDS[c].test(t)) s += 4;
  if (a.skinType && TYPE_WORDS[a.skinType].test(t)) s += 3;
  if (/aurodhea/.test(t)) s += 1; // nouvelle gamme
  return s;
}

export type RoutineStep = { step: StepId; label: string; product: CatalogItem | null; why: string };
export type Routine = { matin: RoutineStep[]; soir: RoutineStep[]; hebdo: RoutineStep[] };

const WHY: Record<StepId, string> = {
  nettoyant: "Élimine sébum, sueur et pollution sans dessécher : la base de toute routine.",
  tonique: "Rééquilibre la peau après le nettoyage et prépare aux soins.",
  serum: "Concentré d'actifs ciblant votre préoccupation principale.",
  jour: "Hydrate et protège du soleil : indispensable aussi sur peau noire, le soleil fonce les taches et marques.",
  nuit: "La peau se répare la nuit : soin plus nourrissant.",
  contour: "Zone fine et souvent plus foncée : soin dédié aux cernes et poches.",
  masque: "Exfolie en douceur (jamais de frottement fort : il laisse des marques sur peau noire) et donne de l'éclat.",
};

/** Routine sans IA : meilleur produit du catalogue pour chaque étape. */
export function ruleRoutine(a: Answers, catalog: CatalogItem[]): Routine {
  const used = new Set<string>();
  const pick = (step: StepId): RoutineStep => {
    const best = catalog
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, s: score(p, step, a) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s || x.p.name.localeCompare(y.p.name, "fr"))[0]?.p ?? null;
    if (best) used.add(best.id);
    return { step, label: STEP_LABELS[step], product: best, why: WHY[step] };
  };
  const needSerum = a.concerns.length > 0;
  const matin = [pick("nettoyant"), ...(needSerum ? [pick("serum")] : []), pick("jour")];
  const soir: RoutineStep[] = [{ ...matin[0] }, pick("nuit")];
  if (a.concerns.includes("cernes")) soir.push(pick("contour"));
  const hebdo = [pick("masque")];
  return { matin, soir, hebdo };
}

/** Conseils adaptés aux peaux noires et métissées, selon les réponses. */
export function adviceFor(a: Answers): string[] {
  const out = ["Protection solaire chaque matin, même sans soleil fort : c'est le meilleur allié contre les taches sur peau noire."];
  if (a.concerns.includes("taches") || a.concerns.includes("boutons")) out.push("Ne percez pas les boutons et évitez les gommages agressifs : chaque irritation peut laisser une marque foncée qui met des mois à partir.");
  if (a.concerns.includes("taches")) out.push("Fuyez les crèmes éclaircissantes (hydroquinone, corticoïdes, « xessal ») : elles abîment la peau et aggravent les taches à long terme.");
  if (a.skinType === "seche" || a.concerns.includes("deshydratation") || a.concerns.includes("terne")) out.push("Un teint « gris » ou terne est souvent un manque d'eau : hydratez matin et soir et buvez suffisamment.");
  if (a.skinType === "grasse" || a.concerns.includes("pores")) out.push("Même une peau grasse a besoin d'hydratation : choisissez des textures légères plutôt que de la décaper.");
  if (a.concerns.includes("poils")) out.push("Rasez dans le sens du poil avec une lame propre, puis appliquez un soin apaisant pour éviter les poils incarnés.");
  out.push("Introduisez un nouveau produit à la fois et testez-le d'abord sur une petite zone.");
  return out;
}

/** Résultat de l'analyse IA, validé. */
export type Analysis = {
  skinType: SkinType | null;
  summary: string;
  scores: { hydratation: number; eclat: number; uniformite: number; imperfections: number; pores: number; fermete: number };
  concerns: { label: string; detail: string }[];
  picks: Partial<Record<StepId, { productId: string; why: string }>>;
  advice: string[];
};

export const SCORE_LABELS: Record<keyof Analysis["scores"], string> = {
  hydratation: "Hydratation",
  eclat: "Éclat",
  uniformite: "Uniformité du teint",
  imperfections: "Peau nette (imperfections)",
  pores: "Grain de peau (pores)",
  fermete: "Fermeté",
};

/** Consignes de l'analyse photo (peaux noires et métissées d'abord). */
export function analysisPrompt(a: Answers, catalog: CatalogItem[]): string {
  const list = catalog.slice(0, 80).map((p) => `${p.id} | ${p.name} | ${p.categoryLabel ?? p.category} | ${(p.shortDescription ?? "").replace(/\s+/g, " ").slice(0, 140)}`).join("\n");
  return `Tu es une conseillère en soins de la peau experte des peaux noires et métissées (phototypes IV à VI), pour JAMAAL, revendeur Chogan au Sénégal.
Analyse la photo du visage (selfie) avec bienveillance. Ce n'est pas un diagnostic médical.

Règles pour les peaux foncées :
- La couleur naturelle de la peau n'est JAMAIS un problème : n'évalue que l'uniformité (taches, marques post-inflammatoires, zones plus foncées autour de la bouche ou des yeux, mélasma).
- Une inflammation apparaît souvent brun-violacé ou plus foncée, pas rouge.
- Un aspect gris ou cendré indique de la déshydratation.
- Ne recommande jamais d'éclaircir ou de blanchir la peau.
- Si la photo est floue, trop sombre, sans visage ou montre plusieurs personnes, réponds {"ok": false, "reason": "<explication courte en français>"}.

Réponses de la personne : type de peau ressenti = ${a.skinType ?? "non précisé"} ; préoccupations = ${a.concerns.join(", ") || "aucune précisée"} ; soleil = ${a.sun ?? "non précisé"} ; âge = ${a.age ?? "non précisé"}.

Catalogue des soins disponibles (identifiant | nom | catégorie | description). Ne choisis QUE parmi ces identifiants, une seule fois chacun, et seulement s'ils conviennent :
${list || "(aucun soin du visage au catalogue pour l'instant)"}

Réponds uniquement en JSON :
{"ok": true,
 "skinType": "grasse|mixte|normale|seche|sensible",
 "summary": "2 phrases chaleureuses, tutoiement interdit, vouvoiement",
 "scores": {"hydratation": 0-100, "eclat": 0-100, "uniformite": 0-100, "imperfections": 0-100, "pores": 0-100, "fermete": 0-100},
 "concerns": [{"label": "court", "detail": "une phrase"}],
 "picks": {"nettoyant": {"productId": "...", "why": "une phrase"}, "tonique": …, "serum": …, "jour": …, "nuit": …, "contour": …, "masque": …},
 "advice": ["3 conseils courts adaptés aux peaux noires"]}
Scores : 100 = excellent. Omet une étape de "picks" s'il n'y a pas de produit adapté.`;
}

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Valide la réponse de l'IA (identifiants de produits inconnus ignorés). */
export function parseAnalysis(raw: unknown, catalogIds: Set<string>): { ok: true; analysis: Analysis } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Analyse illisible." };
  const r = raw as Record<string, unknown>;
  if (r.ok === false) return { ok: false, reason: typeof r.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 200) : "Photo inutilisable." };
  const s = (r.scores ?? {}) as Record<string, unknown>;
  const picks: Analysis["picks"] = {};
  const seen = new Set<string>();
  for (const step of Object.keys(STEP_LABELS) as StepId[]) {
    const p = (r.picks as Record<string, { productId?: unknown; why?: unknown }> | undefined)?.[step];
    const id = typeof p?.productId === "string" ? p.productId : "";
    if (id && catalogIds.has(id) && !seen.has(id)) {
      seen.add(id);
      picks[step] = { productId: id, why: typeof p?.why === "string" ? p.why.slice(0, 200) : WHY[step] };
    }
  }
  return {
    ok: true,
    analysis: {
      skinType: SKIN_TYPES.some((t) => t.id === r.skinType) ? (r.skinType as SkinType) : null,
      summary: typeof r.summary === "string" ? r.summary.slice(0, 400) : "",
      scores: { hydratation: clamp(s.hydratation), eclat: clamp(s.eclat), uniformite: clamp(s.uniformite), imperfections: clamp(s.imperfections), pores: clamp(s.pores), fermete: clamp(s.fermete) },
      concerns: (Array.isArray(r.concerns) ? r.concerns : [])
        .filter((c): c is { label: string; detail?: string } => !!c && typeof (c as { label?: unknown }).label === "string")
        .slice(0, 5)
        .map((c) => ({ label: c.label.slice(0, 60), detail: typeof c.detail === "string" ? c.detail.slice(0, 200) : "" })),
      picks,
      advice: (Array.isArray(r.advice) ? r.advice : []).filter((x): x is string => typeof x === "string").slice(0, 4).map((x) => x.slice(0, 220)),
    },
  };
}

/** Routine finale : choix de l'IA quand il existe, sinon le meilleur produit de chaque étape. */
export function mergeRoutine(base: Routine, analysis: Analysis | null, catalog: CatalogItem[]): Routine {
  if (!analysis) return base;
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const fix = (r: RoutineStep): RoutineStep => {
    const pick = analysis.picks[r.step];
    const p = pick ? byId.get(pick.productId) : null;
    return p ? { ...r, product: p, why: pick!.why || r.why } : r;
  };
  const add = (list: RoutineStep[], step: StepId) => (analysis.picks[step] && !list.some((r) => r.step === step) ? [...list, fix({ step, label: STEP_LABELS[step], product: null, why: WHY[step] })] : list);
  let matin = base.matin.map(fix);
  matin = add(matin, "tonique");
  if (analysis.picks.serum && !matin.some((r) => r.step === "serum")) matin = [matin[0], fix({ step: "serum", label: STEP_LABELS.serum, product: null, why: WHY.serum }), ...matin.slice(1)];
  let soir = base.soir.map(fix);
  soir = add(soir, "contour");
  const order: StepId[] = ["nettoyant", "tonique", "serum", "jour", "nuit", "contour", "masque"];
  const sort = (l: RoutineStep[]) => [...l].sort((x, y) => order.indexOf(x.step) - order.indexOf(y.step));
  return { matin: sort(matin), soir: sort(soir), hebdo: base.hebdo.map(fix) };
}

/** Texte de la routine pour WhatsApp. */
export function routineText(r: Routine, origin: string, ref: string | null): string {
  const line = (s: RoutineStep) => `• ${s.label}${s.product ? ` : ${s.product.name} — ${origin}/produits/${s.product.slug}${ref ? `?ref=${ref}` : ""}` : ""}`;
  return [
    "Ma routine JAMAAL Skin Advisor ✨",
    "",
    "☀️ Matin",
    ...r.matin.map(line),
    "",
    "🌙 Soir",
    ...r.soir.map(line),
    "",
    "📅 Chaque semaine",
    ...r.hebdo.map(line),
    "",
    "Pouvez-vous me conseiller pour commander ?",
  ].join("\n");
}
