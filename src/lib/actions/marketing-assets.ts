"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { uploadMarketingAsset } from "@/lib/upload";

export async function createMarketingAsset(formData: FormData) {
  const session = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "Général").trim() || "Général";
  const file = formData.get("file") as File | null;
  const urlInput = String(formData.get("fileUrl") ?? "").trim();

  if (!title) throw new Error("Titre requis");

  let fileUrl = urlInput;
  if (file && file.size > 0) {
    fileUrl = await uploadMarketingAsset(file);
  }
  if (!fileUrl) throw new Error("Un fichier ou une URL est requis");

  const asset = await prisma.marketingAsset.create({ data: { title, category, fileUrl } });
  await logActivity(session, "Ajout document marketing", "MarketingAsset", asset.id);
  revalidatePath("/admin/kit-marketing");
  revalidatePath("/admin/mon-kit-marketing");
  redirect("/admin/kit-marketing");
}

export async function deleteMarketingAsset(id: string) {
  const session = await requireAdmin();
  await prisma.marketingAsset.delete({ where: { id } });
  await logActivity(session, "Suppression document marketing", "MarketingAsset", id);
  revalidatePath("/admin/kit-marketing");
  revalidatePath("/admin/mon-kit-marketing");
}
