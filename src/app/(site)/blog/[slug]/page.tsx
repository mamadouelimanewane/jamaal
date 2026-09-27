import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/db-content";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-xs text-navy/50">
        <Link href="/blog">Blog</Link> / {post.title}
      </p>
      <h1 className="font-serif-display text-3xl font-semibold text-navy">{post.title}</h1>
      <p className="mt-2 text-xs text-rose-dark">
        {new Date(post.date).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      <div className="mt-6 flex flex-col gap-4">
        {post.content.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-navy/80">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
