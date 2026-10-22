import { auth } from "@/lib/auth";
import { resellerCatalog } from "@/lib/reseller-catalog";
import { MessageCircle } from "lucide-react";
import { getReseller, resellerLinks } from "@/lib/reseller";
import { KitMarketingList } from "@/components/admin/KitMarketingList";

export const dynamic = "force-dynamic";

export default async function KitMarketingPage() {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") {
    return <p className="text-navy">Accès refusé.</p>;
  }

  const me = await getReseller();
  const links = await resellerLinks(me?.slug ?? null);
  // Tout le catalogue (parfums compris) : la recherche trouve chaque produit par nom, code ou catégorie.
  const products = await resellerCatalog();

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Mon Kit Marketing
        </h1>
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Téléchargez les visuels officiels et utilisez nos textes de vente optimisés pour vos statuts WhatsApp et Facebook.
      </p>

      <KitMarketingList
        products={products}
        origin={links.origin}
        refSlug={me?.slug ?? null}
      />

      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="flex items-center gap-2 font-semibold text-emerald-800">
          <MessageCircle size={18} />
          Conseils pour vendre sur WhatsApp
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-emerald-700/80">
          <li>Publiez maximum 3 à 4 statuts par jour pour ne pas lasser vos contacts.</li>
          <li>Accompagnez toujours la photo du parfum avec un court texte inspirant.</li>
          <li>Rappelez régulièrement à vos clients qu&apos;ils gagnent des points de fidélité à chaque achat avec vous.</li>
          <li>Faites des relances douces : « Coucou, je passe une commande JAMAAL demain, tu veux que j&apos;ajoute un parfum pour toi ? »</li>
        </ul>
      </div>
    </div>
  );
}
