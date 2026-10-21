import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const products = await prisma.product.findMany({
    where: { isOfficial: true },
    select: { id: true, slug: true, name: true, shortDescription: true, photo: true, regularPrice: true, choganCode: true, inspiredBy: true, inspiredBrand: true },
    orderBy: { name: "asc" },
  });

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
        products={products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, shortDescription: p.shortDescription, photo: p.photo, price: p.regularPrice, choganCode: p.choganCode, inspiredBy: p.inspiredBy, inspiredBrand: p.inspiredBrand }))}
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
