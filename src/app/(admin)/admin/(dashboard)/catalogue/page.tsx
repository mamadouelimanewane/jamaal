import Link from "next/link";
import { getReseller } from "@/lib/reseller";
import { mySellerRate, resellerCatalog } from "@/lib/reseller-catalog";
import { ResellerCatalogGrid } from "@/components/admin/ResellerCatalogGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produits" };

export default async function CataloguePage() {
  const me = await getReseller();
  const [products, rate] = await Promise.all([resellerCatalog(), me ? mySellerRate(me.id) : Promise.resolve(null)]);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Produits</h1>
          <p className="mt-1 text-sm text-navy/75">
            Tout le catalogue JAMAAL. Touchez un produit pour ses visuels et le partager (WhatsApp, statut, TikTok, galerie), ou cochez-en plusieurs
            pour une sélection.{rate !== null ? ` Votre commission : ${rate} % du prix des produits.` : ""}
          </p>
        </div>
        <Link href="/admin/mon-marketing" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-white">Mon marketing →</Link>
      </div>
      <div className="mt-5">
        <ResellerCatalogGrid products={products} rate={rate} />
      </div>
    </div>
  );
}
