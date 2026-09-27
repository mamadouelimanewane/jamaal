import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BlogForm } from "@/components/admin/BlogForm";
import { updateBlogPost } from "@/lib/actions/blog";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Modifier l&apos;article</h1>
      <BlogForm action={updateBlogPost.bind(null, id)} post={post} />
    </div>
  );
}
