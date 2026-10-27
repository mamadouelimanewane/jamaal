import { getStockRows } from "@/lib/inventory-report";
import { getReseller } from "@/lib/reseller";
import { HandbookView } from "@/components/admin/HandbookView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Le Handbook des stocks Dakar · Instant T",
  description: "Liste officielle et en temps réel de tous les produits Chogan disponibles physiquement au dépôt de Dakar.",
};

export default async function HandbookPage() {
  const [rows, me] = await Promise.all([
    getStockRows(),
    getReseller(),
  ]);

  return (
    <div className="max-w-6xl pb-16">
      <HandbookView
        rows={rows}
        refSlug={me?.slug ?? null}
        consultantName={me?.name ?? null}
      />
    </div>
  );
}
