import { getStockRows } from "@/lib/inventory-report";
import { getReseller } from "@/lib/reseller";
import { HandbookView } from "@/components/admin/HandbookView";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Produits disponibles à Dakar · Instant T",
  description: "Choisissez les produits en stock et partagez leurs liens de commande avec vos clients.",
};

export default async function HandbookPage() {
  const [rows, me, origin] = await Promise.all([getStockRows(), getReseller(), getSiteUrl()]);

  return (
    <div className="max-w-6xl pb-16">
      <HandbookView
        rows={rows}
        refSlug={me?.slug ?? null}
        consultantName={me?.name ?? null}
        origin={origin}
      />
    </div>
  );
}
