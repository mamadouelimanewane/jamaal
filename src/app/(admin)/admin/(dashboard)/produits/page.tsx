import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { deleteProduct } from "@/lib/actions/products";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const products = await prisma.product.findMany({
    where: q
      ? { name: { contains: q, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Produits ({products.length})
        </h1>
        <Link
          href="/admin/produits/nouveau"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + Nouveau produit
        </Link>
      </div>

      <form className="mt-4" action="/admin/produits">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un produit…"
          className="w-full max-w-sm rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-navy"
        />
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix régulier</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{p.name}</td>
                <td className="px-4 py-3 text-navy/70">{p.category}</td>
                <td className="px-4 py-3 text-navy/70">
                  {p.regularPrice ? formatPrice(p.regularPrice) : "—"}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
