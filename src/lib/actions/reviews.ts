"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

export async function submitReview(productSlug: string, formData: FormData) {
  // Action publique : limitée par IP et bornée en taille pour éviter d'inonder la modération.
  const limited = await rateLimit(`review:${clientIpFromHeaders(await headers())}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!limited.ok) throw new Error(`Trop d'avis envoyés. Réessayez dans ${Math.ceil(limited.retryAfterSec / 60)} min.`);

  const authorName = String(formData.get("authorName") ?? "").trim().slice(0, 80);
  const rating = Math.min(5, Math.max(1, Math.round(Number(formData.get("rating") ?? 5)) || 5));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 2000);
  const orderIdInput = String(formData.get("orderId") ?? "").trim().slice(0, 64) || null;

  if (!authorName || !comment) throw new Error("Nom et commentaire requis");

  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) throw new Error("Produit introuvable");

  // Un numéro de commande n'est conservé que s'il correspond vraiment à un achat de ce produit.
  let orderId: string | null = null;
  if (orderIdInput) {
    const match = await prisma.orderItem.findFirst({ where: { orderId: orderIdInput, productId: product.id }, select: { orderId: true } });
    orderId = match?.orderId ?? null;
  }

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
