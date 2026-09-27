import { HeroSlider } from "@/components/HeroSlider";
import { SearchBanner } from "@/components/SearchBanner";
import { CategorySection } from "@/components/CategorySection";
import { InspiredBySection } from "@/components/InspiredBySection";
import { BlogSection } from "@/components/BlogSection";
import { getBestsellers } from "@/lib/db-products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [femme, homme, aurodhea, maquillage, lolum, entretien] = await Promise.all([
    getBestsellers("parfum-femme", 4),
    getBestsellers("parfum-homme", 4),
    getBestsellers("aurodhea", 4),
    getBestsellers("maquillage", 4),
    getBestsellers("lolum", 4),
    getBestsellers("entretien-maison", 4),
  ]);

  return (
    <>
      <HeroSlider />
      <SearchBanner />

      <CategorySection title="JAMAAL Parfum Femme" href="/collections/parfum-femme" products={femme} />
      <CategorySection title="JAMAAL Parfum Homme" href="/collections/parfum-homme" products={homme} />

      <InspiredBySection />

      <CategorySection title="Soins Aurodhea by JAMAAL" href="/collections/aurodhea" products={aurodhea} />
      <CategorySection title="Maquillage JAMAAL" href="/collections/maquillage" products={maquillage} />
      <CategorySection title="Huiles Lolum" href="/collections/lolum" products={lolum} />
      <CategorySection title="Entretien Maison" href="/collections/entretien-maison" products={entretien} />

      <BlogSection />
    </>
  );
}
