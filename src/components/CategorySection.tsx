import Link from "next/link";
import { Product } from "@/data/types";
import { ProductCard } from "./ProductCard";

export function CategorySection({
  title,
  href,
  products,
}: {
  title: string;
  href: string;
  products: Product[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-serif-display text-xl font-semibold text-navy sm:text-2xl">{title}</h2>
        <Link
          href={href}
          className="text-xs font-semibold uppercase tracking-wide text-rose-dark hover:text-navy sm:text-sm"
        >
          Tout afficher →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
