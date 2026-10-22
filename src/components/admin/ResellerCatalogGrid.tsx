"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Search, Share2 } from "lucide-react";
import { useCatalogSearch } from "./useCatalogSearch";
import { estimatedGainLabel } from "@/lib/share-text";
import type { ResellerProduct } from "@/lib/reseller-catalog";

/** Catalogue du revendeur : recherche (nom, code, catégorie), filtre par catégorie, sélection de produits à partager. */
export function ResellerCatalogGrid({ products, rate }: { products: ResellerProduct[]; rate: number | null }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const { results, searching } = useCatalogSearch(products, q, products.length);
  const categories = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const p of products) m.set(p.category, { label: p.categoryLabel, n: (m.get(p.category)?.n ?? 0) + 1 });
    return [...m.entries()].map(([slug, v]) => ({ slug, ...v }));
  }, [products]);
  const base = q.trim().length >= 2 ? results : products;
  const shown = cat ? base.filter((p) => p.category === cat) : base;

  const toggle = (slug: string) => setPicked((l) => (l.includes(slug) ? l.filter((s) => s !== slug) : l.length >= 10 ? l : [...l, slug]));

  return (
    <div>
      <div className="sticky top-[3.6rem] z-20 -mx-1 space-y-3 bg-cream/95 px-1 pb-3 pt-1 backdrop-blur">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 focus-within:border-rose-dark">
          <Search size={16} className="shrink-0 text-navy/50" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un produit" placeholder="Nom, code ou catégorie (ex. Sauvage, 021M, parfum femme)" className="min-w-0 flex-1 text-sm outline-none" />
          {searching ? <Loader2 size={15} className="animate-spin text-navy/40" /> : <span className="shrink-0 text-xs text-navy/60">{shown.length} / {products.length}</span>}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Catégories">
          <button type="button" onClick={() => setCat("")} aria-pressed={!cat} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${!cat ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}>Tout</button>
          {categories.map((c) => (
            <button key={c.slug} type="button" onClick={() => setCat(cat === c.slug ? "" : c.slug)} aria-pressed={cat === c.slug} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${cat === c.slug ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}>
              {c.label} <span className="font-normal opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((p) => {
          const on = picked.includes(p.slug);
          return (
            <article key={p.id} className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white ${on ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-line"}`}>
              <button type="button" onClick={() => toggle(p.slug)} aria-pressed={on} aria-label={on ? `Retirer ${p.name} de la sélection` : `Sélectionner ${p.name}`} className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow ${on ? "border-emerald-600 bg-emerald-600 text-white" : "border-white bg-white/90 text-transparent hover:text-navy/40"}`}>
                <Check size={16} />
              </button>
              <Link href={`/admin/catalogue/${p.slug}`} className="group flex flex-1 flex-col">
                <div className="relative aspect-square w-full bg-cream">
                  {p.photo ? <Image src={p.photo} alt={p.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-contain p-2 transition group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-navy/40"><ImageIcon size={40} /></div>}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h2 className="line-clamp-2 text-sm font-semibold text-navy">{p.name}</h2>
                  <p className="mt-0.5 truncate text-xs text-navy/60">{[p.choganCode, p.categoryLabel].filter(Boolean).join(" · ")}</p>
                  <div className="mt-auto pt-2">
                    {p.price != null && <p className="text-sm font-semibold text-navy">{p.price.toLocaleString("fr-FR")} F</p>}
                    {rate !== null && p.price != null && <p className="text-xs font-semibold text-emerald-700">{estimatedGainLabel(p.price, rate)}</p>}
                  </div>
                </div>
              </Link>
              <Link href={`/admin/catalogue/${p.slug}#partager`} className="flex items-center justify-center gap-1.5 border-t border-line py-2 text-xs font-semibold text-rose-dark hover:bg-cream">
                <Share2 size={13} /> Partager
              </Link>
            </article>
          );
        })}
        {shown.length === 0 && !searching && <p className="col-span-full py-12 text-center text-sm text-navy/70">Aucun produit ne correspond{q ? ` à « ${q} »` : ""}.</p>}
      </div>

      {picked.length > 0 && (
        <div className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-2xl sm:bottom-6">
          <span className="text-sm"><strong>{picked.length}</strong> produit{picked.length > 1 ? "s" : ""} sélectionné{picked.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPicked([])} className="rounded-full px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">Effacer</button>
            <Link href={`/admin/mon-marketing?produits=${picked.join(",")}#partager`} className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b]">
              <Share2 size={15} /> Partager la sélection
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
