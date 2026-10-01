export interface ScentFamily {
  name: string;
  top: string[];
  heart: string[];
  base: string[];
  blurb: string;
}

export const femmeFamilies: ScentFamily[] = [
  {
    name: "Floral Poudré",
    top: ["mandarine", "poire", "bergamote", "pêche"],
    heart: ["pivoine", "fleur d'oranger", "iris", "muguet"],
    base: ["musc blanc", "santal", "fève tonka", "vanille"],
    blurb:
      "Une signature florale et poudrée, pensée pour celles qui aiment les sillages doux et enveloppants.",
  },
  {
    name: "Fruité Gourmand",
    top: ["cassis", "framboise", "mandarine", "poire"],
    heart: ["fleur de pêcher", "jasmin", "praline", "caramel"],
    base: ["vanille", "patchouli", "ambre", "bois de cachemire"],
    blurb:
      "Un accord gourmand et fruité, idéal pour une présence sucrée et affirmée du matin au soir.",
  },
  {
    name: "Oriental Vanillé",
    top: ["safran", "cardamome", "orange sanguine"],
    heart: ["tubéreuse", "jasmin sambac", "fleur d'oranger"],
    base: ["vanille bourbon", "ambre gris", "patchouli", "benjoin"],
    blurb:
      "Un sillage oriental chaleureux, riche en vanille et en ambre, pour une élégance assumée.",
  },
  {
    name: "Boisé Musqué",
    top: ["poivre rose", "bergamote", "cardamome"],
    heart: ["rose de mai", "iris", "violette"],
    base: ["cèdre", "vétiver", "musc blanc", "santal"],
    blurb:
      "Une composition boisée et musquée, pour une féminité moderne et affirmée.",
  },
  {
    name: "Chypré Floral",
    top: ["bergamote", "mandarine", "fruits rouges"],
    heart: ["rose", "jasmin", "pivoine"],
    base: ["mousse de chêne", "patchouli", "labdanum"],
    blurb:
      "Un chypré floral raffiné, entre fraîcheur et profondeur, pour un caractère intemporel.",
  },
  {
    name: "Frais Aquatique",
    top: ["citron", "pamplemousse", "note marine"],
    heart: ["fleur de lotus", "muguet", "jasmin d'eau"],
    base: ["musc", "bois blanc", "ambrette"],
    blurb:
      "Une fragrance fraîche et aquatique, parfaite pour les journées lumineuses et actives.",
  },
];

export const hommeFamilies: ScentFamily[] = [
  {
    name: "Boisé Épicé",
    top: ["poivre noir", "cardamome", "bergamote"],
    heart: ["muscade", "cannelle", "géranium"],
    base: ["cèdre", "vétiver", "patchouli", "ambre"],
    blurb:
      "Un boisé épicé au caractère affirmé, pour un homme qui aime marquer les esprits.",
  },
  {
    name: "Fougère Aromatique",
    top: ["lavande", "bergamote", "menthe"],
    heart: ["géranium", "romarin", "sauge"],
    base: ["mousse de chêne", "coumarine", "vétiver"],
    blurb:
      "Une fougère aromatique fraîche et structurée, un classique intemporel revisité.",
  },
  {
    name: "Cuir Ambré",
    top: ["safran", "poivre rose", "cardamome"],
    heart: ["cuir", "iris", "tabac"],
    base: ["ambre gris", "patchouli", "vanille", "santal"],
    blurb:
      "Une signature cuir et ambre, intense et enveloppante, pour les soirées mémorables.",
  },
  {
    name: "Agrumes Frais",
    top: ["citron", "bergamote", "pamplemousse"],
    heart: ["romarin", "petit grain", "poivre"],
    base: ["musc blanc", "bois de cèdre", "ambroxan"],
    blurb:
      "Un accord d'agrumes frais et vibrant, pour une énergie positive toute la journée.",
  },
  {
    name: "Oriental Épicé",
    top: ["cannelle", "cardamome", "orange"],
    heart: ["encens", "muscade", "rose"],
    base: ["oud", "ambre", "patchouli", "vanille"],
    blurb:
      "Un oriental épicé riche et envoûtant, pour une présence puissante et raffinée.",
  },
  {
    name: "Marin Aquatique",
    top: ["note marine", "citron vert", "bergamote"],
    heart: ["ambroxan", "géranium", "romarin"],
    base: ["musc", "bois de cèdre", "vétiver"],
    blurb:
      "Une fragrance marine et minérale, fraîche et moderne, pour un style décontracté.",
  },
];

export const bottleGradients: [string, string][] = [
  ["#1d2f4f", "#d9a99d"],
  ["#273b60", "#eac2b6"],
  ["#b47a6c", "#1d2f4f"],
  ["#d9a99d", "#1d2f4f"],
  ["#1d2f4f", "#d9b08c"],
  ["#3a2c22", "#d9a99d"],
];
