"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Gift, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";

export interface OfferCardData {
  slug: string;
  title: string;
  occasion: string | null;
  description: string;
  image: string | null;
  packPrice: number;
  value: number;
  endsAt: string;
  products: { id: string; slug: string; name: string; photo?: string; colorFrom: string; colorTo: string; volumeLabel: string; price: number }[];
}

/** Coffret de fêtes : produits, prix barré, et ajout de tout le coffret au panier en un geste. */
export function OfferCard({ offer, large = false }: { offer: OfferCardData; large?: boolean }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const saving = offer.value - offer.packPrice;
  const until = new Date(offer.endsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return (
    <article className={`flex flex-col overflow-hidden rounded-3xl border border-ia/25 bg-white shadow-sm ${large ? "" : "h-full"}`}>
      <div className="flex items-center justify-between gap-2 bg-ia px-5 py-3 text-white">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">
          <Gift size={15} /> {offer.occasion ?? "Offre spéciale"}
        </span>
        <span className="text-xs text-white/85">jusqu&apos;au {until}</span>
      </div>
      <div className={`grid gap-2 bg-ia-light/50 p-4 ${offer.products.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
        {offer.products.slice(0, 3).map((p) => (
          <Link key={p.id} href={`/produits/${p.slug}`} className="relative aspect-square overflow-hidden rounded-2xl bg-white">
            {p.photo ? (
              <Image src={p.photo} alt={p.name} fill sizes="160px" className="object-contain p-2" />
            ) : (
              <span className="block h-full w-full" style={{ background: `linear-gradient(135deg, ${p.colorFrom}, ${p.colorTo})` }} />
            )}
          </Link>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif-display text-xl font-semibold text-navy">
          <Link href={`/offres/${offer.slug}`}>{offer.title}</Link>
        </h3>
        {offer.description && <p className={`mt-1 text-sm text-navy/75 ${large ? "" : "line-clamp-2"}`}>{offer.description}</p>}
        <ul className="mt-3 space-y-0.5 text-sm text-navy/80">
          {offer.products.map((p) => (
            <li key={p.id}>• {p.name} <span className="text-navy/50">({p.volumeLabel})</span></li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-semibold text-ia-dark">{formatPrice(offer.packPrice)}</span>
            <span className="text-sm text-navy/50 line-through">{formatPrice(offer.value)}</span>
            <span className="rounded-full bg-ia-light px-2 py-0.5 text-xs font-semibold text-ia-dark">−{formatPrice(saving)}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              for (const p of offer.products) addItem({ productId: p.id, slug: p.slug, name: p.name, volumeLabel: p.volumeLabel, price: p.price, colorFrom: p.colorFrom, colorTo: p.colorTo });
              setAdded(true);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ia py-3 text-sm font-semibold text-white hover:bg-ia-dark"
          >
            <ShoppingBag size={16} /> {added ? "Coffret ajouté ✓" : "Ajouter le coffret au panier"}
          </button>
          <p className="mt-2 text-center text-[11px] text-navy/55">La remise s&apos;applique automatiquement au panier.</p>
        </div>
      </div>
    </article>
  );
}
