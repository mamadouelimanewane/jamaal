import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteCategory } from "@/lib/actions/categories";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { position: "asc" } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Catégories ({categories.length})
        </h1>
        <Link
          href="/admin/categories/nouveau"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + Nouvelle catégorie
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Ordre</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Accent</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 text-navy/75">{c.position}</td>
                <td className="px-4 py-3 font-medium text-navy">{c.label}</td>
                <td className="px-4 py-3 text-navy/75">{c.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      c.accent === "rose" ? "bg-rose/20 text-rose-dark" : "bg-navy/10 text-navy"
                    }`}
                  >
                    {c.accent}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/categories/${c.id}/modifier`}
                    className="mr-3 text-xs font-semibold text-navy hover:underline"
                  >
                    Modifier
                  </Link>
                  <form action={deleteCategory.bind(null, c.id)} className="inline">
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
