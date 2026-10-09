export type CategorySlug =
  | "parfum-femme"
  | "parfum-homme"
  | "parfum-unisexe"
  | "aurodhea"
  | "lolum"
  | "maquillage"
  | "bijoux"
  | "entretien-maison"
  | "parfum-ambiance"
  | "complement-alimentaire"
  | "autres-produits"
  | "gels-douche"
  | "cremes-corps"
  | "etuis-parfum"
  | "soins-corps"
  | "soins-visage"
  | "soins-cheveux"
  | "soleil"
  | "remedes-onguents"
  | "animaux"
  | "nutrition-sport"
  | "substituts-repas"
  | "cafe-boissons"
  | "accessoires";

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
  /** Code produit Chogan (ex. 001M, 060, BSF016). */
  choganCode?: string;
  /** Parfum de grande marque dont s'inspire la fragrance, et sa marque. */
  inspiredBy?: string;
  inspiredBrand?: string;
  /** Stock disponible par format (libellé → quantité), sur la fiche produit. */
  availability?: Record<string, number>;
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
  /** Prix public Chogan en FCFA (base du prix de vente JAMAAL). */
  publicPrice?: number;
  /** true si ce produit vient de l'import officiel (import/products.csv) plutôt que du catalogue de démonstration. */
  isOfficial?: boolean;
}
