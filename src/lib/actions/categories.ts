"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

function categoryDataFromForm(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    label: String(formData.get("label") ?? "").trim(),
    navLabel: String(formData.get("navLabel") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    accent: String(formData.get("accent") ?? "navy"),
    position: Number(formData.get("position") ?? 0) || 0,
  };
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  await prisma.category.create({ data: categoryDataFromForm(formData) });
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.category.update({ where: { id }, data: categoryDataFromForm(formData) });
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}
