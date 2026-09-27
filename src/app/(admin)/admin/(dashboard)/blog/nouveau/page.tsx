import { BlogForm } from "@/components/admin/BlogForm";
import { createBlogPost } from "@/lib/actions/blog";

export default function NewBlogPostPage() {
  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouvel article</h1>
      <BlogForm action={createBlogPost} />
    </div>
  );
}
