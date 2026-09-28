export type QuizGender = "femme" | "homme" | "unisexe";
export type QuizOccasion = "quotidien" | "soiree" | "travail" | "cadeau";
export type QuizFamily = "frais" | "floral" | "boise" | "oriental" | "sucre";
export type QuizIntensity = "discret" | "modere" | "intense";

export interface QuizAnswers {
  gender: QuizGender | null;
  occasion: QuizOccasion | null;
  family: QuizFamily | null;
  intensity: QuizIntensity | null;
}

export const quizSteps = [
  {
    key: "gender" as const,
    question: "Pour qui cherchez-vous un parfum ?",
    options: [
      { value: "femme", label: "Femme" },
      { value: "homme", label: "Homme" },
      { value: "unisexe", label: "Peu importe / unisexe" },
    ],
  },
  {
    key: "occasion" as const,
    question: "Quelle occasion principale ?",
    options: [
      { value: "quotidien", label: "Tous les jours" },
      { value: "travail", label: "Travail / bureau" },
      { value: "soiree", label: "Soirée / sortie" },
      { value: "cadeau", label: "Cadeau" },
    ],
  },
  {
    key: "family" as const,
    question: "Quelle famille olfactive vous attire ?",
    options: [
      { value: "frais", label: "Frais, agrumes, marin" },
      { value: "floral", label: "Floral, poudré" },
      { value: "boise", label: "Boisé, terreux" },
      { value: "oriental", label: "Oriental, épicé, ambré" },
      { value: "sucre", label: "Gourmand, vanillé, sucré" },
    ],
  },
  {
    key: "intensity" as const,
    question: "Quelle intensité préférez-vous ?",
    options: [
      { value: "discret", label: "Discret, près de la peau" },
      { value: "modere", label: "Présent mais élégant" },
      { value: "intense", label: "Sillage marqué" },
    ],
  },
];

/** Mapping simple famille → mots-clés pour filtrer le catalogue */
export const familyKeywords: Record<QuizFamily, string[]> = {
  frais: ["frais", "agrume", "citrus", "marin", "aquatique", "bergamote", "citron", "menthe"],
  floral: ["floral", "rose", "jasmin", "fleur", "poudré", "iris", "pivoine"],
  boise: ["bois", "boisé", "cèdre", "vetiver", "santal", "patchouli", "mousse"],
  oriental: ["oriental", "ambre", "épicé", "encens", "oud", "musc", "poivre"],
  sucre: ["vanille", "sucré", "gourmand", "caramel", "tonka", "praline", "cacao"],
};

export const genderCategory: Record<QuizGender, string[]> = {
  femme: ["parfum-femme"],
  homme: ["parfum-homme"],
  unisexe: ["parfum-unisexe", "parfum-femme", "parfum-homme"],
};
