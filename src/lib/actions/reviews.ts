"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

export async function submitReview(productSlug: string, formData: FormData) {
  const authorName = String(formData.get("authorName") ?? "").trim();
  const rating = Math.min(5, Math.max(1, Number(formData.get("rating") ?? 5)));
  const comment = String(formData.get("comment") ?? "").trim();
  const orderId = String(formData.get("orderId") ?? "").trim() || null;

  if (!authorName || !comment) throw new Error("Nom et commentaire requis");

  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) throw new Error("Produit introuvable");

  await prisma.review.create({
    data: { productId: product.id, authorName, rating, comment, orderId },
  });
  revalidatePath(`/produits/${productSlug}`);
  revalidatePath("/admin/avis");
}

export async function approveReview(id: string) {
  const session = await requireAdmin();
  const review = await prisma.review.update({ where: { id }, data: { approved: true } });

  const agg = await prisma.review.aggregate({
    where: { productId: review.productId, approved: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: review.productId },
    data: {
      rating: agg._avg.rating ?? 4.5,
      reviewCount: agg._count,
    },
  });

  await logActivity(session, "Approbation avis client", "Review", id);
  revalidatePath("/admin/avis");
  revalidatePath("/produits");
}

export async function deleteReview(id: string) {
  const session = await requireAdmin();
  await prisma.review.delete({ where: { id } });
  await logActivity(session, "Suppression avis client", "Review", id);
  revalidatePath("/admin/avis");
}
