import { HeroSlider } from "@/components/HeroSlider";
import { SearchBanner } from "@/components/SearchBanner";
import { CategorySection } from "@/components/CategorySection";
import { InspiredBySection } from "@/components/InspiredBySection";
import { BlogSection } from "@/components/BlogSection";
import { getBestsellers } from "@/data/products";

export default function Home() {
  return (
    <>
      <HeroSlider />
      <SearchBanner />

      <CategorySection
        title="JAMAAL Parfum Femme"
        href="/collections/parfum-femme"
        products={getBestsellers("parfum-femme", 4)}
      />
      <CategorySection
        title="JAMAAL Parfum Homme"
        href="/collections/parfum-homme"
        products={getBestsellers("parfum-homme", 4)}
      />

      <InspiredBySection />

      <CategorySection
        title="Soins Aurodhea by JAMAAL"
        href="/collections/aurodhea"
        products={getBestsellers("aurodhea", 4)}
      />
      <CategorySection
        title="Maquillage JAMAAL"
        href="/collections/maquillage"
        products={getBestsellers("maquillage", 4)}
      />
      <CategorySection
        title="Huiles Lolum"
        href="/collections/lolum"
        products={getBestsellers("lolum", 4)}
      />
      <CategorySection
        title="Entretien Maison"
        href="/collections/entretien-maison"
        products={getBestsellers("entretien-maison", 4)}
      />

      <BlogSection />
    </>
  );
}
