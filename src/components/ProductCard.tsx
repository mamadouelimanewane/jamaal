import Link from "next/link";
import { Product } from "@/data/types";
import { ProductVisual } from "./ProductVisual";
import { StarRating } from "./StarRating";
import { formatPrice } from "@/lib/currency";

export function ProductCard({ product }: { product: Product }) {
  const displayPrice = product.testerPrice ?? product.regularPrice ?? 0;
  const priceLabel = product.testerPrice
    ? `Échantillon dès ${formatPrice(product.testerPrice)}`
    : `Prix régulier ${formatPrice(product.regularPrice ?? 0)}`;

  return (
    <Link
      href={`/produits/${product.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/5"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-cream">
        <ProductVisual
          product={product}
          className="h-full w-full transition group-hover:scale-105"
        />
        {product.badge && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ${
              product.badge === "bestseller"
                ? "bg-rose-dark"
                : product.badge === "nouveau"
                ? "bg-navy"
                : "bg-zinc-400"
            }`}
          >
            {product.badge === "bestseller" ? "Best-seller" : product.badge === "nouveau" ? "Nouveau" : "Épuisé"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-serif-display text-sm font-semibold text-navy line-clamp-1">
          {product.name}
        </h3>
        <p className="line-clamp-1 text-xs text-navy/60">{product.shortDescription}</p>
        <StarRating rating={product.rating} count={product.reviewCount} />
        <p className="mt-1 text-sm font-medium text-rose-dark">{priceLabel}</p>
      </div>
    </Link>
  );
}
