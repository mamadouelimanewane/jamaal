import { getReseller } from "@/lib/reseller";
import { OfficialCatalogueView } from "@/components/admin/OfficialCatalogueView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalogue Officiel JAMAAL · Édition Luxe",
  description: "Le catalogue complet des parfums et cosmétiques Chogan au format brochure haute définition avec les prix JAMAAL en FCFA.",
};

export default async function CatalogueOfficielPage() {
  const me = await getReseller();

  return (
    <div className="pb-16 print:p-0">
      <OfficialCatalogueView
        consultantName={me?.name || null}
        consultantPhone={me?.whatsapp || null}
        consultantCity={me?.city || "Dakar"}
        consultantSlug={me?.slug || null}
      />
    </div>
  );
}
