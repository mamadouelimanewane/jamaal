import Link from "next/link";
import { getBlogPosts } from "@/lib/db-content";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const blogPosts = await getBlogPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">Blog JAMAAL</h1>
      <div className="mt-8 flex flex-col gap-6">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="text-xs font-medium text-rose-dark">
              {new Date(post.date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <h2 className="mt-1 font-serif-display text-xl font-semibold text-navy">{post.title}</h2>
            <p className="mt-2 text-sm text-navy/70">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
