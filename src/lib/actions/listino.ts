"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { LISTINO, mergeVolumes } from "@/lib/listino";
import { loadListinoPlan } from "@/lib/listino-db";

export type ListinoApplyResult = { ok: boolean; message?: string; error?: string };

/**
 * Ajoute les formats manquants du listing (30 ml, 15 ml recharge, 50 ml…) aux produits du site, avec leur code
 * Chogan et leur prix. Idempotent (relancer ne duplique rien) et additif : aucun prix ni stock existant n'est modifié.
 * Un produit sans lignes de stock par format reçoit aussi celle de son format principal, avec son stock actuel
 * (sinon une vente du format principal serait décomptée sur le mauvais format).
 */
export async function applyListinoAction(): Promise<ListinoApplyResult> {
  const session = await requireAdmin();
  try {
    const plan = await loadListinoPlan();
    if (!plan.items.length) return { ok: true, message: "Rien à ajouter : tous les formats du listing sont déjà sur le site." };
    let products = 0, formats = 0;
    for (const item of plan.items) {
      await prisma.$transaction(async (tx) => {
        const p = await tx.product.findUnique({ where: { id: item.productId }, select: { choganCode: true, volumes: true, stock: true, lowStockThreshold: true } });
        if (!p) return;
        const volumes = mergeVolumes(p.volumes, item.add, p.choganCode);
        await tx.product.update({ where: { id: item.productId }, data: { volumes: volumes as unknown as Prisma.InputJsonValue } });
        const rows: Prisma.ProductVariantCreateManyInput[] = [];
        const hasVariants = (await tx.productVariant.count({ where: { productId: item.productId } })) > 0;
        if (!hasVariants && item.mainLabel) rows.push({ productId: item.productId, volumeLabel: item.mainLabel, code: p.choganCode, stock: p.stock, lowStockThreshold: p.lowStockThreshold });
        for (const f of item.add) rows.push({ productId: item.productId, volumeLabel: f.label, code: f.code, stock: 0, lowStockThreshold: 3 });
        await tx.productVariant.createMany({ data: rows, skipDuplicates: true });
      });
      products++;
      formats += item.add.length;
    }
    await logActivity(session, `Listino ${LISTINO.edition} : ${formats} format(s) ajouté(s) sur ${products} produit(s)`, "Product");
    revalidatePath("/admin/produits");
    revalidatePath("/admin/produits/listino");
    revalidatePath("/admin/stocks");
    revalidatePath("/collections", "layout");
    return { ok: true, message: `${formats} format(s) ajouté(s) sur ${products} produit(s).` };
  } catch (e) {
    console.error("[listino] application", e);
    return { ok: false, error: "L'ajout des formats a échoué. Réessayez ; rien n'est dupliqué en cas de relance." };
  }
}
