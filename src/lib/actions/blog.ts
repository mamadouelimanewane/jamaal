"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

function blogDataFromForm(formData: FormData) {
  const dateVal = String(formData.get("date") ?? "");
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    excerpt: String(formData.get("excerpt") ?? "").trim(),
    content: String(formData.get("content") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    published: formData.get("published") === "on",
    date: dateVal ? new Date(dateVal) : new Date(),
  };
}

export async function createBlogPost(formData: FormData) {
  await requireAdmin();
  const data = blogDataFromForm(formData);
  await prisma.blogPost.create({ data });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  redirect("/admin/blog");
}

export async function updateBlogPost(id: string, formData: FormData) {
  await requireAdmin();
  const previous = await prisma.blogPost.findUnique({ where: { id } });
  const data = blogDataFromForm(formData);
  await prisma.blogPost.update({ where: { id }, data });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${data.slug}`);
  if (previous && previous.slug !== data.slug) revalidatePath(`/blog/${previous.slug}`);
  redirect("/admin/blog");
}

export async function deleteBlogPost(id: string) {
  await requireAdmin();
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}
