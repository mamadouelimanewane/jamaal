import { searchProducts } from "@/lib/db-products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchProducts(q);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Résultats pour « {q} »
      </h1>
      <p className="mt-1 text-sm text-navy/60">{results.length} produit(s) trouvé(s)</p>

      {results.length === 0 ? (
        <p className="mt-10 text-sm text-navy/60">
          Aucun résultat. Essayez un autre nom, un parfum de marque (ex : « Sauvage », « Dior »), un code Chogan (ex : « 001M ») ou un numéro de fiche.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
