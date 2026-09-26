import { Category } from "./types";

export const categories: Category[] = [
  {
    slug: "parfum-femme",
    label: "Parfum JAMAAL Femme",
    navLabel: "JAMAAL Femme",
    description:
      "Une collection de parfums pour femme, inspirés des plus grandes maisons de parfumerie, conçus pour révéler votre élégance au quotidien.",
    accent: "rose",
  },
  {
    slug: "parfum-homme",
    label: "Parfum JAMAAL Homme",
    navLabel: "JAMAAL Homme",
    description:
      "Des fragrances masculines intenses et raffinées, pensées pour affirmer votre caractère en toute occasion.",
    accent: "navy",
  },
  {
    slug: "aurodhea",
    label: "Soins Aurodhea",
    navLabel: "Aurodhea",
    description:
      "Une gamme de soins visage et cheveux haut de gamme, pour sublimer votre peau au quotidien.",
    accent: "rose",
  },
  {
    slug: "lolum",
    label: "Huiles Lolum",
    navLabel: "Lolum",
    description:
      "Des mélanges d'huiles végétales et essentielles, formulés pour nourrir, repulper et purifier la peau.",
    accent: "rose",
  },
  {
    slug: "maquillage",
    label: "Maquillage JAMAAL",
    navLabel: "Maquillage",
    description:
      "Une sélection de maquillage longue tenue, pour sublimer votre regard et votre teint.",
    accent: "rose",
  },
  {
    slug: "bijoux",
    label: "Bijoux à offrir",
    navLabel: "Bijoux",
    description:
      "Des bijoux délicats à associer à votre parfum préféré, pour un cadeau inoubliable.",
    accent: "navy",
  },
  {
    slug: "entretien-maison",
    label: "Entretien Maison",
    navLabel: "Entretien Maison",
    description:
      "Des produits d'entretien concentrés et écoresponsables pour une maison impeccable.",
    accent: "navy",
  },
  {
    slug: "parfum-ambiance",
    label: "Parfums d'ambiance",
    navLabel: "Parfum d'ambiance",
    description:
      "Diffusez chez vous les senteurs signature JAMAAL grâce à notre gamme de parfums d'intérieur.",
    accent: "rose",
  },
  {
    slug: "complement-alimentaire",
    label: "Compléments alimentaires",
    navLabel: "Compléments",
    description:
      "Des compléments alimentaires pensés pour accompagner votre bien-être au quotidien.",
    accent: "navy",
  },
  {
    slug: "autres-produits",
    label: "Autres produits JAMAAL",
    navLabel: "Autres produits",
    description: "Le reste de notre univers JAMAAL, à découvrir sans attendre.",
    accent: "navy",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
