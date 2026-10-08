import Link from "next/link";
import type { Metadata } from "next";
import { searchCatalog } from "@/lib/search-index";
import { getProductsByIds } from "@/lib/db-products";
import { ProductCard } from "@/components/ProductCard";
import { SearchPageInput } from "@/components/SearchPageInput";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Recherche", robots: { index: false } };

const SORTS = [
  { id: "pertinence", label: "Pertinence" },
  { id: "prix-asc", label: "Prix croissant" },
  { id: "prix-desc", label: "Prix décroissant" },
] as const;

const SUGGESTIONS = ["Sauvage", "Baccarat Rouge 540", "One Million", "Black Opium", "La Vie est Belle", "Oud Wood"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; tri?: string; marque?: string }> }) {
  const { q = "", cat, tri = "pertinence", marque } = await searchParams;
  const r = q.trim() ? await searchCatalog(q, 200) : null;

  let hits = r?.hits ?? [];
  if (cat) hits = hits.filter((h) => h.doc.category === cat);
  if (marque) hits = hits.filter((h) => h.doc.inspiredBrand === marque);
  if (tri === "prix-asc") hits = [...hits].sort((a, b) => (a.doc.price ?? Infinity) - (b.doc.price ?? Infinity));
  if (tri === "prix-desc") hits = [...hits].sort((a, b) => (b.doc.price ?? 0) - (a.doc.price ?? 0));
  const products = await getProductsByIds(hits.slice(0, 96).map((h) => h.doc.id));

  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const v = { q: r?.query ?? q, cat, tri: tri === "pertinence" ? undefined : tri, marque, ...over };
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    return `/recherche?${p.toString()}`;
  };
  const chip = (on: boolean) =>
    `rounded-full border px-4 py-2 text-sm transition ${on ? "border-[#14213b] bg-[#14213b] text-white" : "border-[#eadfda] bg-white text-navy hover:border-[#c9997a] hover:bg-[#f5ece8]"}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9c6254]">Recherche</p>
      <div className="mt-3">
        <SearchPageInput initial={r?.query ?? q} />
      </div>

      {!r ? (
        <div className="mt-8">
          <p className="text-sm text-navy/65">Quelques idées :</p>
          <div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <Link key={s} href={`/recherche?q=${encodeURIComponent(s)}`} className={chip(false)}>{s}</Link>)}</div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-serif-display text-2xl text-navy sm:text-3xl">
              {hits.length} parfum{hits.length > 1 ? "s" : ""} pour « {r.query} »
            </h1>
            <div className="flex flex-wrap gap-1.5 text-sm">
              {SORTS.map((s) => (
                <Link key={s.id} href={link({ tri: s.id === "pertinence" ? undefined : s.id })} className={`rounded-full px-3 py-1.5 ${tri === s.id ? "bg-[#f5ece8] font-semibold text-navy" : "text-navy/60 hover:text-navy"}`}>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          {r.corrected && (
            <p className="mt-3 rounded-xl bg-[#f5ece8] px-4 py-3 text-sm text-navy/80">
              Aucun résultat pour « {q} ». Résultats affichés pour <b className="text-navy">« {r.corrected} »</b>.
            </p>
          )}

          {(r.categories.length > 1 || r.brands.length > 1) && (
            <div className="mt-5 flex flex-col gap-3">
              {r.categories.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <Link href={link({ cat: undefined })} className={chip(!cat)}>Toutes les collections</Link>
                  {r.categories.map((c) => <Link key={c.slug} href={link({ cat: c.slug })} className={chip(cat === c.slug)}>{c.label} <span className="opacity-60">{c.count}</span></Link>)}
                </div>
              )}
              {r.brands.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9c6254]">Inspiré de</span>
                  {marque && <Link href={link({ marque: undefined })} className={chip(false)}>Toutes les marques</Link>}
                  {r.brands.slice(0, 12).map((b) => <Link key={b.brand} href={link({ marque: b.brand })} className={chip(marque === b.brand)}>{b.brand} <span className="opacity-60">{b.count}</span></Link>)}
                </div>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <div className="mt-12 rounded-3xl border border-[#eadfda] bg-white px-6 py-12 text-center">
              <p className="font-serif-display text-2xl text-navy">Aucun parfum trouvé</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-navy/60">Essayez le nom d&apos;un grand parfum (« Sauvage »), une marque (« Dior »), une note (« vanille ») ou un code Chogan (« 001M »).</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">{SUGGESTIONS.map((s) => <Link key={s} href={`/recherche?q=${encodeURIComponent(s)}`} className={chip(false)}>{s}</Link>)}</div>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
