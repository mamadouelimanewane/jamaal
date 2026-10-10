import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { deleteProduct } from "@/lib/actions/products";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stock?: string }>;
}) {
  const { q = "", stock } = await searchParams;
  const products = await prisma.product.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { choganCode: { startsWith: q, mode: "insensitive" } }, ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : [])] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const filtered = stock === "bas" ? products.filter((p) => p.stock <= p.lowStockThreshold) : products;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Produits ({filtered.length})
        </h1>
        <div className="flex flex-wrap gap-2">
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
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un produit…"
          className="w-full max-w-sm rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-navy"
        />
        <label className="flex items-center gap-2 text-xs text-navy/85">
          <input type="checkbox" name="stock" value="bas" defaultChecked={stock === "bas"} />
          Stock bas uniquement
        </label>
        <button type="submit" className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream">
          Filtrer
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix régulier</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isLow = p.stock <= p.lowStockThreshold;
              return (
                <tr key={p.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-3 text-navy/85"><span className="font-semibold text-navy">{p.choganCode ?? "—"}</span>{p.number ? <span className="block text-xs text-navy/65">Fiche {p.number}</span> : null}</td>
                  <td className="px-4 py-3 font-medium text-navy">{p.name}</td>
                  <td className="px-4 py-3 text-navy/85">{p.category}</td>
                  <td className="px-4 py-3 text-navy/85">
                    {p.regularPrice ? formatPrice(p.regularPrice) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isLow ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {p.stock}
                    </span>
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
      </div>
    </div>
  );
}
