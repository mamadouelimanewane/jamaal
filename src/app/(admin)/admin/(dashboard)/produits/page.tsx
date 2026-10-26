import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { deleteProduct } from "@/lib/actions/products";
import { getStockRows } from "@/lib/inventory-report";
import { getCategories } from "@/lib/db-categories";
import { productStockSummary, rankProducts } from "@/lib/admin-search";
import { LiveSearchInput } from "@/components/admin/LiveSearchInput";

export const dynamic = "force-dynamic";

const PER_PAGE = 60;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stock?: string; cat?: string; page?: string }>;
}) {
  const { q = "", stock, cat = "", page = "1" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const [ranking, stockRows, categories] = await Promise.all([
    query ? rankProducts(query) : Promise.resolve(null),
    getStockRows(),
    getCategories(),
  ]);

  // Stock réel : somme des formats (le champ « stock » du produit ne vaut que sans formats).
  const stockOf = productStockSummary(stockRows);
  const products = await prisma.product.findMany({
    where: {
      ...(ranking ? { id: { in: ranking.ids } } : {}),
      ...(cat ? { category: cat } : {}),
    },
    select: { id: true, name: true, category: true, choganCode: true, number: true, inspiredBy: true, inspiredBrand: true, regularPrice: true, stock: true, lowStockThreshold: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (ranking) {
    // Ordre de pertinence de la recherche.
    const rank = new Map(ranking.ids.map((id, i) => [id, i]));
    products.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  }

  const totalOf = (p: { id: string; stock: number }) => stockOf.get(p.id)?.total ?? p.stock;
  const isLow = (p: { id: string }) => (stockOf.get(p.id)?.status ?? "ok") !== "ok";
  const availCount = products.filter((p) => totalOf(p) > 0).length;
  const lowCount = products.filter(isLow).length;
  const filtered =
    stock === "dispo" ? products.filter((p) => totalOf(p) > 0) : stock === "bas" ? products.filter(isLow) : products;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const labels = new Map(categories.map((c) => [c.slug as string, c.navLabel.replace("JAMAAL ", "")]));
  const usedCats = categories.filter((c) => stockRows.some((r) => r.category === c.slug));
  const link = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: query, stock, cat, ...over })) if (v) sp.set(k, v);
    const str = sp.toString();
    return `/admin/produits${str ? `?${str}` : ""}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Produits ({filtered.length.toLocaleString("fr-FR")})
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/produits/chogan"
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            Importer depuis Chogan
          </Link>
          <Link
            href="/admin/produits/listino"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            Listino Chogan
          </Link>
          <Link
            href="/admin/produits/import"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            Importer Excel
          </Link>
          <a
            href="/api/export/produits"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            Exporter Excel ↓
          </a>
          <Link
            href="/admin/categories"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            Catégories
          </Link>
          <Link
            href="/admin/produits/nouveau"
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + Nouveau produit
          </Link>
        </div>
      </div>

      <form className="mt-4 flex flex-wrap items-center gap-3" action="/admin/produits">
        <Suspense>
          <LiveSearchInput
            key={query}
            initial={query}
            placeholder="Nom, code (001M, 301M…), parfum (Sauvage), marque, n° de fiche"
            className="w-full max-w-md"
          />
        </Suspense>
        <select name="cat" defaultValue={cat} className="rounded-lg border border-line px-3 py-2 text-sm text-navy">
          <option value="">Toutes les collections</option>
          {usedCats.map((c) => (
            <option key={c.slug} value={c.slug}>{c.navLabel.replace("JAMAAL ", "")}</option>
          ))}
        </select>
        {(stock === "dispo" || stock === "bas") && <input type="hidden" name="stock" value={stock} />}
        <button type="submit" className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream">
          Filtrer
        </button>
        {(query || cat || stock) && (
          <Link href="/admin/produits" className="text-xs text-navy/70 hover:text-navy">Réinitialiser</Link>
        )}
      </form>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrer par stock">
        {[
          { v: undefined, label: "Tous les produits", n: products.length },
          { v: "dispo", label: "✓ Disponibles (en stock)", n: availCount },
          { v: "bas", label: "Rupture ou stock bas", n: lowCount },
        ].map((f) => {
          const active = (stock === "dispo" || stock === "bas" ? stock : undefined) === f.v;
          return (
            <Link
              key={f.label}
              href={link({ stock: f.v, page: undefined })}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${active ? "bg-navy text-white" : "border border-line text-navy hover:bg-cream"}`}
            >
              {f.label} ({f.n.toLocaleString("fr-FR")})
            </Link>
          );
        })}
      </div>
      {ranking?.corrected && (
        <p className="mt-2 text-sm text-navy/75">
          Résultats pour <strong>{ranking.corrected}</strong> (orthographe corrigée).
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Nom Chogan · inspiration</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix régulier</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const st = stockOf.get(p.id) ?? { total: p.stock, formats: 1, rupture: 0, bas: 0, status: p.stock <= 0 ? "rupture" : p.stock <= p.lowStockThreshold ? "bas" : "ok" };
              return (
                <tr key={p.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-3 text-navy/85"><span className="font-semibold text-navy">{p.choganCode ?? "—"}</span>{p.number ? <span className="block text-xs text-navy/65">Fiche {p.number}</span> : null}</td>
                  <td className="px-4 py-3 font-medium text-navy">
                    {p.name}
                    {(p.inspiredBy || p.inspiredBrand) && (
                      <span className="block text-xs font-medium text-[#8a5a44]">
                        Inspiré de {[p.inspiredBy, p.inspiredBrand].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy/85">{labels.get(p.category) ?? p.category}</td>
                  <td className="px-4 py-3 text-navy/85">
                    {p.regularPrice ? formatPrice(p.regularPrice) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/admin/stocks?q=${encodeURIComponent(p.choganCode ?? p.name)}`}
                      title="Voir le détail par format"
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        st.status === "rupture" ? "bg-red-100 text-red-700" : st.status === "bas" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {st.total}
                    </Link>
                    {st.formats > 1 && (
                      <span className="mt-1 block text-xs text-navy/65">
                        {st.formats} formats{st.rupture ? ` · ${st.rupture} en rupture` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/produits/${p.id}/modifier`}
                      className="mr-3 text-xs font-semibold text-navy hover:underline"
                    >
                      Modifier
                    </Link>
                    <form action={deleteProduct.bind(null, p.id)} className="inline">
                      <button className="text-xs font-semibold text-rose-dark hover:underline">
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <p className="px-5 py-10 text-center text-sm text-navy/70">
            Aucun produit ne correspond{query ? ` à « ${query} »` : ""}. Essayez un code, un nom de parfum ou une marque.
          </p>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-navy/75">
          <span>Page {current} sur {pages}</span>
          <div className="flex gap-2">
            {current > 1 && <Link href={link({ page: String(current - 1) })} className="rounded-lg border border-line px-3 py-1.5 font-semibold text-navy hover:border-navy">Précédente</Link>}
            {current < pages && <Link href={link({ page: String(current + 1) })} className="rounded-lg border border-line px-3 py-1.5 font-semibold text-navy hover:border-navy">Suivante</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
