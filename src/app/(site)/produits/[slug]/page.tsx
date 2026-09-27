import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductsByCategory } from "@/lib/db-products";
import { getCategory } from "@/lib/db-categories";
import { ProductVisual } from "@/components/ProductVisual";
import { StarRating } from "@/components/StarRating";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = await getCategory(product.category);
  const related = (await getProductsByCategory(product.category))
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="mb-4 text-xs text-navy/50">
        <Link href="/">Accueil</Link> /{" "}
        <Link href={`/collections/${product.category}`}>{category?.label}</Link> / {product.name}
      </p>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-cream">
          <ProductVisual product={product} className="h-full w-full" sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>

        <div>
          <h1 className="font-serif-display text-3xl font-semibold text-navy">{product.name}</h1>
          {product.family && (
            <p className="mt-1 text-sm font-medium text-rose-dark">{product.family}</p>
          )}
          <div className="mt-2">
            <StarRating rating={product.rating} count={product.reviewCount} />
          </div>

          <div className="mt-6">
            <ProductPurchasePanel product={product} />
          </div>

          {(product.topNotes || product.heartNotes || product.baseNotes) && (
            <div className="mt-8 grid grid-cols-3 gap-3 rounded-2xl border border-line bg-white p-4 text-center text-xs">
              <div>
                <p className="font-semibold uppercase tracking-wide text-navy/50">Tête</p>
                <p className="mt-1 text-navy">{product.topNotes?.join(", ")}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-navy/50">Cœur</p>
                <p className="mt-1 text-navy">{product.heartNotes?.join(", ")}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-navy/50">Fond</p>
                <p className="mt-1 text-navy">{product.baseNotes?.join(", ")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 max-w-3xl">
        {product.longDescription.map((p, i) => (
          <p key={i} className="mb-4 text-sm leading-relaxed text-navy/80">
            {p}
          </p>
        ))}
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="mb-5 font-serif-display text-xl font-semibold text-navy">
            Les clients ont également regardé
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
