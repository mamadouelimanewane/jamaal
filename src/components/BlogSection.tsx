import Link from "next/link";
import { getBlogPosts } from "@/lib/db-content";

export async function BlogSection() {
  const blogPosts = await getBlogPosts(3);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-serif-display text-xl font-semibold text-navy sm:text-2xl">
          Blog JAMAAL
        </h2>
        <Link
          href="/blog"
          className="text-xs font-semibold uppercase tracking-wide text-rose-dark hover:text-navy sm:text-sm"
        >
          Tout afficher →
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="text-xs font-medium text-rose-dark">
              {new Date(post.date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <h3 className="font-serif-display text-base font-semibold text-navy">{post.title}</h3>
            <p className="line-clamp-2 text-sm text-navy/60">{post.excerpt}</p>
            <span className="mt-1 text-xs font-semibold text-navy">Lire la suite →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
