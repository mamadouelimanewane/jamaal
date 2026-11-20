import { getStockRows } from "@/lib/inventory-report";
import { getReseller } from "@/lib/reseller";
import { HandbookView } from "@/components/admin/HandbookView";
import { getSiteUrl } from "@/lib/site-url";
import { isUnsoldFormat } from "@/lib/price-from";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Produits disponibles à Dakar · Instant T",
  description: "Choisissez les produits en stock et partagez leurs liens de commande avec vos clients.",
};

export default async function HandbookPage() {
  const [rows, me, origin] = await Promise.all([getStockRows(), getReseller(), getSiteUrl()]);
  // Formats en vente seulement : les 15 ml et recharges ne sont pas proposés aux revendeurs.
  const hasSold = new Set(rows.filter((r) => !isUnsoldFormat(r.format)).map((r) => r.productId));
  const forSale = rows.filter((r) => !isUnsoldFormat(r.format) || !hasSold.has(r.productId));

  return (
    <div className="max-w-6xl pb-16">
      <HandbookView
        rows={forSale}
        refSlug={me?.slug ?? null}
        consultantName={me?.name ?? null}
        origin={origin}
      />
    </div>
  );
}
