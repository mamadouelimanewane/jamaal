"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

export async function adjustStock(productId: string, variantId: string | null, formData: FormData) {
  const session = await requireAdmin();
  const delta = Number(formData.get("delta"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Saisissez une variation entière différente de zéro.");
  if (!reason || reason.length > 180) throw new Error("Le motif est obligatoire (180 caractères maximum).");

  await prisma.$transaction(async (tx) => {
    const target = variantId
      ? await tx.productVariant.findUnique({ where: { id: variantId } })
      : await tx.product.findUnique({ where: { id: productId } });
    if (!target || ("productId" in target && target.productId !== productId)) throw new Error("Référence de stock introuvable.");
    const previousStock = target.stock;
    const nextStock = previousStock + delta;
    if (nextStock < 0) throw new Error("Le stock ne peut pas devenir négatif.");

    if (variantId) await tx.productVariant.update({ where: { id: variantId }, data: { stock: nextStock } });
    else await tx.product.update({ where: { id: productId }, data: { stock: nextStock } });

    await tx.stockMovement.create({
      data: { productId, variantId, userId: session.user?.id ?? null, delta, previousStock, nextStock, reason },
    });
  });

  await logActivity(session, "Ajustement de stock", "Product", productId);
  revalidatePath("/admin/stocks");
  revalidatePath("/admin/produits");
}
