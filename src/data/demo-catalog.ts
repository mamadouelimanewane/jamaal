import { Product } from "./types";
import { femmeFamilies, hommeFamilies, bottleGradients, ScentFamily } from "./notes";

// Petit générateur pseudo-aléatoire déterministe (mêmes résultats à chaque build)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[], count: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function buildPerfume(
  number: number,
  category: "parfum-femme" | "parfum-homme",
  families: ScentFamily[]
): Product {
  const rng = mulberry32(number * (category === "parfum-femme" ? 7919 : 7883));
  const family = families[Math.floor(rng() * families.length)];
  const top = pick(rng, family.top, 3);
  const heart = pick(rng, family.heart, 3);
  const base = pick(rng, family.base, 3);
  const [colorFrom, colorTo] = bottleGradients[number % bottleGradients.length];
  const reviewCount = 3 + Math.floor(rng() * 90);
  const rating = 4.3 + rng() * 0.6;
  const testerPrice = rng() > 0.6 ? 2 : rng() > 0.3 ? 1.5 : 1;

  const genre = category === "parfum-femme" ? "féminine" : "masculine";
  const pronom = category === "parfum-femme" ? "elle" : "il";

  return {
    id: `${category}-${number}`,
    number,
    slug: `jamaal-n-${number}`,
    name: `Parfum JAMAAL N°${number}`,
    category,
    family: family.name,
    topNotes: top,
    heartNotes: heart,
    baseNotes: base,
    shortDescription: `${family.name} — inspiré des grandes maisons de parfumerie`,
    longDescription: [
      `Le Parfum JAMAAL N°${number} appartient à la famille olfactive ${family.name}. ${family.blurb}`,
      `Cette fragrance ${genre} s'ouvre sur des notes de tête de ${top.join(", ")}, avant de révéler un cœur de ${heart.join(", ")}. Le fond, plus profond, se compose de ${base.join(", ")}, pour une tenue longue durée sur la peau.`,
      `Concentré en essence de parfum pour une meilleure tenue, ${pronom === "elle" ? "il" : "il"} s'applique sur les points de pulsation (poignets, cou, derrière les oreilles) pour un sillage optimal tout au long de la journée.`,
      `Fabriqué à partir d'alcool alimentaire dénaturé de qualité et d'une sélection rigoureuse d'ingrédients, le Parfum JAMAAL N°${number} incarne l'exigence et l'élégance de la maison JAMAAL Luxury Cosmetics.`,
    ],
    testerPrice,
    volumes: [
      { label: "Échantillon 3 ml", price: testerPrice },
      { label: "30 ml", price: 19.9 },
      { label: "70 ml", price: 34.9 },
    ],
    reviewCount,
    rating: Math.round(rating * 10) / 10,
    badge: reviewCount > 70 ? "bestseller" : number % 17 === 0 ? "nouveau" : undefined,
    colorFrom,
    colorTo,
  };
}

const femmeNumbers = [
  2, 5, 7, 9, 11, 14, 18, 21, 23, 26, 28, 31, 34, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69,
  72, 75, 78, 81, 84,
];
const hommeNumbers = [
  101, 103, 105, 108, 110, 112, 115, 117, 119, 122, 124, 126, 129, 131, 133, 136, 138, 140, 143,
  145, 147, 150, 152, 154, 156, 158, 160, 162, 164, 166,
];

const perfumesFemme = femmeNumbers.map((n) => buildPerfume(n, "parfum-femme", femmeFamilies));
const perfumesHomme = hommeNumbers.map((n) => buildPerfume(n, "parfum-homme", hommeFamilies));

function simpleProduct(p: {
  id: string;
  name: string;
  category: Product["category"];
  price: number;
  description: string[];
  reviewCount?: number;
  colorIndex?: number;
  badge?: Product["badge"];
}): Product {
  const [colorFrom, colorTo] = bottleGradients[(p.colorIndex ?? 0) % bottleGradients.length];
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    category: p.category,
    shortDescription: p.description[0],
    longDescription: p.description,
    regularPrice: p.price,
    reviewCount: p.reviewCount ?? 4,
    rating: 4.5,
    badge: p.badge,
    colorFrom,
    colorTo,
  };
}

const aurodhea: Product[] = [
  simpleProduct({
    id: "aurodhea-creme-anti-age",
    name: "Crème Visage Anti-Âge Précieuse",
    category: "aurodhea",
    price: 39.9,
    colorIndex: 1,
    reviewCount: 12,
    description: [
      "Une crème anti-âge riche, formulée pour lisser les rides et raviver l'éclat du teint.",
      "Sa texture fondante nourrit intensément la peau tout en respectant son film hydrolipidique naturel.",
      "Appliquez matin et soir sur peau propre, en mouvements circulaires ascendants.",
    ],
  }),
  simpleProduct({
    id: "aurodhea-shampoing-nutrition",
    name: "Shampoing Nutrition Intense",
    category: "aurodhea",
    price: 13.9,
    colorIndex: 2,
    reviewCount: 8,
    description: [
      "Un shampoing doux pour lavages fréquents, qui nettoie sans agresser le cuir chevelu.",
      "Formulé pour redonner souplesse et brillance aux cheveux ternes et fatigués.",
    ],
  }),
  simpleProduct({
    id: "aurodhea-shampoing-aloe",
    name: "Shampoing Douceur à l'Aloe Vera",
    category: "aurodhea",
    price: 10.9,
    colorIndex: 3,
    description: [
      "Un shampoing quotidien enrichi en aloe vera, pour un cuir chevelu apaisé et des cheveux souples.",
    ],
  }),
  simpleProduct({
    id: "aurodhea-serum-eclat",
    name: "Sérum Éclat Concentré",
    category: "aurodhea",
    price: 34.9,
    colorIndex: 4,
    badge: "nouveau",
    description: [
      "Un sérum concentré en actifs éclaircissants, pour un teint uniforme et lumineux.",
      "Quelques gouttes suffisent pour révéler un teint frais dès le réveil.",
    ],
  }),
  simpleProduct({
    id: "aurodhea-huile-solaire",
    name: "Huile Solaire Nourrissante 150 ml",
    category: "aurodhea",
    price: 15.9,
    colorIndex: 5,
    reviewCount: 5,
    description: [
      "Une huile solaire qui protège tout en nourrissant la peau exposée au soleil.",
      "Sa formule non grasse laisse un fini satiné sans effet collant.",
    ],
  }),
  simpleProduct({
    id: "aurodhea-spray-solaire-spf50",
    name: "Spray Solaire SPF 50 150 ml",
    category: "aurodhea",
    price: 32.9,
    colorIndex: 0,
    reviewCount: 6,
    description: [
      "Une protection solaire élevée en spray facile à appliquer, résistante à l'eau.",
    ],
  }),
];

const lolum: Product[] = [
  simpleProduct({
    id: "lolum-ultra-oil-repulpante",
    name: "ULTRA OIL — Mélange Repulpant & Hydratant 50 ml",
    category: "lolum",
    price: 49.9,
    colorIndex: 1,
    reviewCount: 9,
    description: [
      "Un mélange d'huiles végétales précieuses aux vertus repulpantes et hydratantes.",
      "Idéal en soin du soir pour retrouver une peau souple et rebondie.",
    ],
  }),
  simpleProduct({
    id: "lolum-revizent",
    name: "REVIZENT — Mélange d'Huiles Essentielles Multifonctionnel 50 ml",
    category: "lolum",
    price: 34.9,
    colorIndex: 2,
    reviewCount: 6,
    description: [
      "Une synergie d'huiles essentielles pensée pour accompagner le bien-être quotidien.",
    ],
  }),
  simpleProduct({
    id: "lolum-ultra-oil-purifiante",
    name: "ULTRA OIL — Mélange Purifiant & Antibactérien 50 ml",
    category: "lolum",
    price: 44.9,
    colorIndex: 3,
    description: [
      "Un mélange d'huiles aux propriétés purifiantes, pensé pour les peaux à imperfections.",
    ],
  }),
  simpleProduct({
    id: "lolum-huile-eclat",
    name: "LOLUM Éclat — Huile Sèche Multi-Usages 50 ml",
    category: "lolum",
    price: 29.9,
    colorIndex: 4,
    badge: "nouveau",
    description: [
      "Une huile sèche pour le corps, le visage et les pointes de cheveux, à l'absorption rapide.",
    ],
  }),
];

const maquillage: Product[] = [
  simpleProduct({
    id: "maquillage-ombre-paupiere",
    name: "Ombre à Paupières Shimmer Rose 3,5 g",
    category: "maquillage",
    price: 19.0,
    colorIndex: 0,
    description: ["Un fard scintillant longue tenue pour un regard sublimé en un geste."],
  }),
  simpleProduct({
    id: "maquillage-stick-contour-ebene",
    name: "Stick Contour Sculpt & Lift — Ébène",
    category: "maquillage",
    price: 19.9,
    colorIndex: 1,
    description: ["Un stick contouring crémeux pour sculpter le visage avec précision."],
  }),
  simpleProduct({
    id: "maquillage-stick-contour-argile",
    name: "Stick Contour Sculpt & Lift — Argile",
    category: "maquillage",
    price: 19.9,
    colorIndex: 2,
    description: ["Une teinte contouring naturelle pour un fini mat et modelé."],
  }),
  simpleProduct({
    id: "maquillage-rouge-levres",
    name: "Rouge à Lèvres Velouté Longue Tenue",
    category: "maquillage",
    price: 16.9,
    colorIndex: 3,
    description: ["Un rouge à lèvres au fini velouté, confortable toute la journée."],
  }),
  simpleProduct({
    id: "maquillage-mascara",
    name: "Mascara Volume Intense",
    category: "maquillage",
    price: 17.9,
    colorIndex: 4,
    description: ["Un mascara qui gaine et volumise les cils sans les alourdir."],
  }),
  simpleProduct({
    id: "maquillage-fond-de-teint",
    name: "Fond de Teint Fluide Haute Couvrance",
    category: "maquillage",
    price: 24.9,
    colorIndex: 5,
    badge: "nouveau",
    description: ["Un fond de teint modulable pour un teint unifié et naturel."],
  }),
];

const bijoux: Product[] = [
  simpleProduct({
    id: "bijoux-collier-perle-rose",
    name: "Collier Perle Rosée",
    category: "bijoux",
    price: 24.9,
    colorIndex: 0,
    description: ["Un collier délicat à offrir avec votre parfum JAMAAL préféré."],
  }),
  simpleProduct({
    id: "bijoux-bracelet-doré",
    name: "Bracelet Fin Doré",
    category: "bijoux",
    price: 19.9,
    colorIndex: 1,
    description: ["Un bracelet fin et intemporel, idéal en cadeau d'accompagnement."],
  }),
  simpleProduct({
    id: "bijoux-boucles-oreilles",
    name: "Boucles d'Oreilles Pendantes",
    category: "bijoux",
    price: 22.9,
    colorIndex: 2,
    description: ["Des boucles d'oreilles légères et élégantes pour toutes les occasions."],
  }),
  simpleProduct({
    id: "bijoux-bague-ajustable",
    name: "Bague Ajustable Nacrée",
    category: "bijoux",
    price: 17.9,
    colorIndex: 3,
    description: ["Une bague ajustable au design épuré, à associer à vos bijoux préférés."],
  }),
];

const entretienMaison: Product[] = [
  simpleProduct({
    id: "entretien-nettoyant-joints",
    name: "Nettoyant Concentré Joints & Carrelage",
    category: "entretien-maison",
    price: 19.9,
    colorIndex: 0,
    reviewCount: 9,
    description: ["Un nettoyant concentré qui redonne éclat aux joints et carrelages ternis."],
  }),
  simpleProduct({
    id: "entretien-degraissant",
    name: "Dégraissant Super-Concentré Cuisine",
    category: "entretien-maison",
    price: 15.9,
    colorIndex: 1,
    reviewCount: 9,
    description: ["Un dégraissant puissant pour assainir hottes, plaques et surfaces grasses."],
  }),
  simpleProduct({
    id: "entretien-wc",
    name: "Détartrant WC Action Blanchissante",
    category: "entretien-maison",
    price: 12.9,
    colorIndex: 2,
    reviewCount: 2,
    description: ["Un détartrant concentré qui élimine le calcaire et fait briller la cuvette."],
  }),
  simpleProduct({
    id: "entretien-vitres",
    name: "Nettoyant Vitres Sans Traces",
    category: "entretien-maison",
    price: 11.9,
    colorIndex: 3,
    description: ["Une formule concentrée pour des vitres impeccables, sans traces."],
  }),
];

const complementAlimentaire: Product[] = [
  simpleProduct({
    id: "complement-multivitamine-gel",
    name: "Complément Multivitaminé en Gel 300 ml",
    category: "complement-alimentaire",
    price: 24.9,
    colorIndex: 0,
    reviewCount: 4,
    description: ["Un complexe multivitaminé sous forme de gel, facile à intégrer au quotidien."],
  }),
  simpleProduct({
    id: "complement-lipo-gelules",
    name: "Complément en Gélules — Équilibre & Vitalité",
    category: "complement-alimentaire",
    price: 46.9,
    colorIndex: 1,
    reviewCount: 3,
    description: ["Une formule en gélules pensée pour accompagner votre équilibre corporel."],
  }),
  simpleProduct({
    id: "complement-drainant",
    name: "Complexe Drainant 300 ml",
    category: "complement-alimentaire",
    price: 44.9,
    colorIndex: 2,
    description: ["Un complément liquide formulé pour soutenir le drainage naturel de l'organisme."],
  }),
];

const parfumAmbiance: Product[] = [
  simpleProduct({
    id: "ambiance-diffuseur-santal",
    name: "Diffuseur d'Intérieur — Santal Ambré",
    category: "parfum-ambiance",
    price: 22.9,
    colorIndex: 0,
    description: ["Un diffuseur par capillarité qui parfume durablement votre intérieur."],
  }),
  simpleProduct({
    id: "ambiance-bougie-vanille",
    name: "Bougie Parfumée — Vanille & Bois Blanc",
    category: "parfum-ambiance",
    price: 18.9,
    colorIndex: 1,
    description: ["Une bougie à la cire végétale, pour une ambiance chaleureuse et enveloppante."],
  }),
  simpleProduct({
    id: "ambiance-brume-linge",
    name: "Brume Textile & Linge — Fleur Blanche",
    category: "parfum-ambiance",
    price: 14.9,
    colorIndex: 2,
    description: ["Une brume délicate pour parfumer linge de maison et textiles d'ameublement."],
  }),
];

const autresProduits: Product[] = [
  simpleProduct({
    id: "autres-coffret-decouverte-femme",
    name: "Coffret Découverte — 6 Miniatures Femme",
    category: "autres-produits",
    price: 14.9,
    colorIndex: 0,
    badge: "bestseller",
    reviewCount: 41,
    description: ["Un coffret de 6 échantillons pour découvrir nos meilleures ventes féminines."],
  }),
  simpleProduct({
    id: "autres-coffret-decouverte-homme",
    name: "Coffret Découverte — 6 Miniatures Homme",
    category: "autres-produits",
    price: 14.9,
    colorIndex: 1,
    badge: "bestseller",
    reviewCount: 33,
    description: ["Un coffret de 6 échantillons pour découvrir nos meilleures ventes masculines."],
  }),
  simpleProduct({
    id: "autres-etui-voyage",
    name: "Étui de Voyage Vaporisateur Rechargeable",
    category: "autres-produits",
    price: 9.9,
    colorIndex: 2,
    description: ["Un vaporisateur de poche rechargeable, pour emporter votre parfum partout."],
  }),
];

export const demoProducts: Product[] = [
  ...perfumesFemme,
  ...perfumesHomme,
  ...aurodhea,
  ...lolum,
  ...maquillage,
  ...bijoux,
  ...entretienMaison,
  ...complementAlimentaire,
  ...parfumAmbiance,
  ...autresProduits,
];
