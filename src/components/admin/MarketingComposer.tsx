"use client";

import { useState } from "react";
import { ProductPicker } from "./ProductPicker";
import { ShareStudio } from "./ShareStudio";
import type { ResellerProduct } from "@/lib/reseller-catalog";

/**
 * « Mon marketing » : choisir un ou plusieurs produits, puis les envoyer à un client, en statut WhatsApp,
 * sur TikTok, ou les enregistrer dans la galerie.
 */
export function MarketingComposer({ products, origin, refSlug, initialSlugs = [] }: { products: ResellerProduct[]; origin: string; refSlug: string | null; initialSlugs?: string[] }) {
  const [selected, setSelected] = useState<ResellerProduct[]>(() => initialSlugs.map((s) => products.find((p) => p.slug === s)).filter((p): p is ResellerProduct => !!p));

  return (
    <div className="space-y-5">
      <ProductPicker products={products} selected={selected} onChange={setSelected} max={10} />
      {selected.length ? (
        <ShareStudio items={selected} origin={origin} refSlug={refSlug} />
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-navy/70">Cherchez un produit ci-dessus et touchez-le pour l&apos;ajouter (jusqu&apos;à 10 à la fois).</p>
      )}
    </div>
  );
}
