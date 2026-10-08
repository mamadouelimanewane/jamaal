import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Download, Image as ImageIcon, MessageCircle } from "lucide-react";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function KitMarketingPage() {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") {
    return <p className="text-navy">Accès refusé.</p>;
  }

  const products = await prisma.product.findMany({
    where: { isOfficial: true },
    select: { id: true, name: true, shortDescription: true, photo: true, regularPrice: true },
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

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="relative aspect-square w-full bg-cream">
              {p.photo ? (
                <Image src={p.photo} alt={p.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-navy/45">
                  <ImageIcon size={48} />
                </div>
              )}
            </div>
            <div className="p-4">
              <h2 className="font-semibold text-navy">{p.name}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-navy/75">{p.shortDescription}</p>
              
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={p.photo || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-navy transition hover:bg-line"
                >
                  <Download size={14} /> Télécharger la photo
                </a>
                
                <div className="rounded-xl border border-line bg-cream/30 p-3 text-xs">
                  <p className="font-semibold text-navy/85">Texte pour statut :</p>
                  <p className="mt-1 italic text-navy/75">
                    Découvrez {p.name}, la fragrance idéale pour vous démarquer. Qualité premium à prix accessible ! Contactez-moi pour commander.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
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
