import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/db-content";

export const dynamic = "force-dynamic";

const loadPost = cache(getBlogPostBySlug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post || !post.published) return { title: "Article introuvable", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${post.slug}`,
      title: post.title,
      description: post.excerpt,
      publishedTime: new Date(post.date).toISOString(),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPost(slug);
  // Un article dépublié ne doit plus être accessible par son adresse.
  if (!post || !post.published) notFound();

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
