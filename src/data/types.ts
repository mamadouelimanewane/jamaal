export type CategorySlug =
  | "parfum-femme"
  | "parfum-homme"
  | "aurodhea"
  | "lolum"
  | "maquillage"
  | "bijoux"
  | "entretien-maison"
  | "parfum-ambiance"
  | "complement-alimentaire"
  | "autres-produits";

export interface Category {
  slug: CategorySlug;
  label: string;
  navLabel: string;
  description: string;
  accent: "navy" | "rose";
}

export interface VolumeOption {
  label: string;
  price: number;
}

export interface Product {
  id: string;
  number?: number;
  slug: string;
  name: string;
  category: CategorySlug;
  family?: string;
  topNotes?: string[];
  heartNotes?: string[];
  baseNotes?: string[];
  shortDescription: string;
  longDescription: string[];
  testerPrice?: number;
  volumes?: VolumeOption[];
  regularPrice?: number;
  reviewCount: number;
  rating: number;
  badge?: "bestseller" | "nouveau" | "epuise";
  colorFrom: string;
  colorTo: string;
  /** Chemin d'une vraie photo produit (ex: "/produits/n42.jpg"), fournie via import/. Si absent, on affiche le flacon SVG placeholder. */
  photo?: string;
  /** true si ce produit vient de l'import officiel (import/products.csv) plutôt que du catalogue de démonstration. */
  isOfficial?: boolean;
}
