"use client";

import { useMemo, useState } from "react";
import { Product } from "@/data/types";
import { ProductCard } from "./ProductCard";

type SortKey = "pertinence" | "prix-asc" | "prix-desc" | "az" | "za";

function priceOf(p: Product) {
  return p.testerPrice ?? p.regularPrice ?? 0;
}

export function CollectionGrid({ products }: { products: Product[] }) {
  const [sort, setSort] = useState<SortKey>("pertinence");

  const sorted = useMemo(() => {
    const copy = [...products];
    switch (sort) {
      case "prix-asc":
        return copy.sort((a, b) => priceOf(a) - priceOf(b));
      case "prix-desc":
        return copy.sort((a, b) => priceOf(b) - priceOf(a));
      case "az":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "za":
        return copy.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return copy.sort((a, b) => b.reviewCount - a.reviewCount);
    }
  }, [products, sort]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-navy/60">{products.length} produits</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full border border-line bg-white px-3 py-2 text-sm text-navy outline-none"
        >
          <option value="pertinence">En vedette</option>
          <option value="prix-asc">Prix : faible à élevé</option>
          <option value="prix-desc">Prix : élevé à faible</option>
          <option value="az">Alphabétique, A à Z</option>
          <option value="za">Alphabétique, Z à A</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
