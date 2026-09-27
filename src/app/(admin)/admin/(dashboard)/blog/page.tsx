import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteBlogPost } from "@/lib/actions/blog";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({ orderBy: { date: "desc" } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Articles de blog ({posts.length})
        </h1>
        <Link
          href="/admin/blog/nouveau"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + Nouvel article
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{p.title}</td>
                <td className="px-4 py-3 text-navy/70">{p.date.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">
                  {p.published ? (
                    <span className="text-xs font-semibold text-green-700">Publié</span>
                  ) : (
                    <span className="text-xs font-semibold text-navy/40">Brouillon</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/blog/${p.id}/modifier`}
                    className="mr-3 text-xs font-semibold text-navy hover:underline"
                  >
                    Modifier
                  </Link>
                  <form action={deleteBlogPost.bind(null, p.id)} className="inline">
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
