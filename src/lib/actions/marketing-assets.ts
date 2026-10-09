"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { uploadMarketingAsset } from "@/lib/upload";

async function createMarketingAssetImpl(formData: FormData) {
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

async function deleteMarketingAssetImpl(id: string) {
  const session = await requireAdmin();
  await prisma.marketingAsset.delete({ where: { id } });
  await logActivity(session, "Suppression document marketing", "MarketingAsset", id);
  revalidatePath("/admin/kit-marketing");
  revalidatePath("/admin/mon-kit-marketing");
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function createMarketingAsset(formData: FormData): Promise<void> {
  try {
    await createMarketingAssetImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin");
  }
}

export async function deleteMarketingAsset(id: string): Promise<void> {
  try {
    await deleteMarketingAssetImpl(id);
  } catch (e) {
    await backWithError(e, "/admin");
  }
}
