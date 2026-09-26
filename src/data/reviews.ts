export interface Review {
  name: string;
  rating: number;
  text: string;
}

export const reviews: Review[] = [
  {
    name: "Khadija",
    rating: 5,
    text: "Le Parfum JAMAAL N°42 tient toute la journée, exactement ce que je cherchais.",
  },
  {
    name: "Ibrahima",
    rating: 5,
    text: "Très bonne surprise pour la gamme homme, sillage boisé qui dure vraiment longtemps.",
  },
  {
    name: "Aminata",
    rating: 4,
    text: "Livraison rapide et flacon très élégant, je recommande la crème Aurodhea aussi.",
  },
  {
    name: "Cheikh",
    rating: 5,
    text: "Rapport qualité-prix excellent, je suis devenu client régulier.",
  },
];
