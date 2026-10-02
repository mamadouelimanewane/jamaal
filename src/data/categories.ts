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
    slug: "parfum-unisexe",
    navLabel: "JAMAAL Unisexe",
    label: "Parfum JAMAAL Unisexe",
    description:
      "Des fragrances unisexes, entre bois précieux, ambre et notes minérales, à porter sans distinction.",
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
  {
    slug: "gels-douche",
    label: "Gels douche parfumés",
    navLabel: "Gels douche",
    description:
      "Des gels douche parfumés, inspirés des grands parfums, pour une toilette sensorielle.",
    accent: "rose",
  },
  {
    slug: "cremes-corps",
    label: "Crèmes corps parfumées",
    navLabel: "Crèmes corps",
    description:
      "Des crèmes corporelles parfumées qui hydratent et laissent un sillage délicat.",
    accent: "rose",
  },
  {
    slug: "etuis-parfum",
    label: "Étuis parfum de poche",
    navLabel: "Étuis de poche",
    description:
      "Des étuis élégants pour emporter votre parfum partout avec vous.",
    accent: "navy",
  },
  {
    slug: "soins-corps",
    label: "Soins corps & hygiène",
    navLabel: "Soins corps",
    description:
      "Savons, crèmes, déodorants et soins d'hygiène au quotidien.",
    accent: "rose",
  },
  {
    slug: "soins-visage",
    label: "Soins du visage",
    navLabel: "Soins visage",
    description:
      "Nettoyants, sérums, crèmes et masques pour toutes les peaux.",
    accent: "rose",
  },
  {
    slug: "soins-cheveux",
    label: "Soins cheveux",
    navLabel: "Soins cheveux",
    description:
      "Shampoings, masques, sérums et brumes pour des cheveux en pleine santé.",
    accent: "navy",
  },
  {
    slug: "soleil",
    label: "Produits solaires",
    navLabel: "Solaire",
    description:
      "Sprays, huiles et soins après-soleil pour profiter de l'été en toute sérénité.",
    accent: "rose",
  },
  {
    slug: "remedes-onguents",
    label: "Remèdes & onguents",
    navLabel: "Remèdes",
    description:
      "Gels apaisants, pommades et baumes pour les petits maux du quotidien.",
    accent: "navy",
  },
  {
    slug: "animaux",
    label: "Produits pour animaux",
    navLabel: "Animaux",
    description:
      "Une gamme de soins dédiée à vos compagnons à quatre pattes.",
    accent: "navy",
  },
  {
    slug: "nutrition-sport",
    label: "Nutrition sportive",
    navLabel: "Nutrition sport",
    description:
      "Compléments pour accompagner vos entraînements et votre récupération.",
    accent: "navy",
  },
  {
    slug: "substituts-repas",
    label: "Substituts de repas",
    navLabel: "Substituts de repas",
    description:
      "Des shakes pour un repas équilibré, rapide et gourmand.",
    accent: "navy",
  },
  {
    slug: "cafe-boissons",
    label: "Café & boissons",
    navLabel: "Café",
    description:
      "Cafés en grains, capsules, dosettes et boissons chaudes.",
    accent: "navy",
  },
  {
    slug: "accessoires",
    label: "Accessoires",
    navLabel: "Accessoires",
    description:
      "Accessoires, goodies et articles à associer à votre routine.",
    accent: "navy",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
