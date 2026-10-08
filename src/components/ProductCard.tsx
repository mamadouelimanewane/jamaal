import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/data/types";
import { ProductVisual } from "./ProductVisual";
import { StarRating } from "./StarRating";
import { formatPrice } from "@/lib/currency";

export function ProductCard({ product }: { product: Product }) {
  const priceLabel = product.testerPrice
    ? `Échantillon · ${formatPrice(product.testerPrice)}`
    : `À partir de ${formatPrice(product.regularPrice ?? product.volumes?.[0]?.price ?? 0)}`;
  return <Link href={`/produits/${product.slug}`} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8e634b]">
    <div className="relative aspect-[4/5] overflow-hidden bg-[#f5ece8]">
      <ProductVisual product={product} fit="contain" className="h-full w-full p-3 transition duration-700 ease-out group-hover:scale-[1.045] sm:p-5" sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 22vw"/>
      {product.badge && <span className="absolute left-3 top-3 bg-[#fdfbfa]/90 px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#1d2f4f] backdrop-blur-sm">{product.badge === "bestseller" ? "La signature" : product.badge === "nouveau" ? "Nouveauté" : "Épuisé"}</span>}
      <span aria-hidden="true" className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-[#fdfbfa] text-navy opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"><ArrowUpRight size={17}/></span>
    </div>
    <div className="pt-3.5">
      {product.family && <p className="text-[8px] uppercase tracking-[0.17em] text-[#9c6254]">{product.family}</p>}
      <h3 className="mt-1 font-serif-display text-[15px] font-medium leading-snug text-[#14213b] sm:text-lg">{product.name}</h3>
      {product.choganCode || product.number ? (
        <p className="mt-0.5 text-[11px] text-navy/60 sm:text-xs">
          {product.choganCode ? <>Code <span className="font-semibold text-navy/80">{product.choganCode}</span></> : null}
          {product.choganCode && product.number ? " · " : null}
          {product.number ? <>Fiche {product.number}</> : null}
        </p>
      ) : null}
      <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-navy/55 sm:text-xs">{product.shortDescription}</p>
      {product.reviewCount > 0 && <div className="mt-2"><StarRating rating={product.rating} count={product.reviewCount}/></div>}
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy sm:text-[11px]">{priceLabel}</p>
    </div>
  </Link>;
}