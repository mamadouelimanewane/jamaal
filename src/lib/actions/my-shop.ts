"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getReseller } from "@/lib/reseller";
import { MAX_FAVORITES } from "@/lib/shop/consultant-shop";

export type ShopState = { ok: boolean; message?: string; error?: string };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Le consultant personnalise sa boutique (/c/<slug>) : photo, présentation, coups de cœur. */
export async function updateMyShop(_prev: ShopState, fd: FormData): Promise<ShopState> {
  const me = await getReseller();
  if (!me) return { ok: false, error: "Session invalide." };
  if (me.viewAs) return { ok: false, error: "Mode consultation : modification impossible." };

  const bio = String(fd.get("bio") ?? "").trim().replace(/\s+/g, " ").slice(0, 220) || null;
  const ids = fd.getAll("productIds").map(String).filter(Boolean).slice(0, MAX_FAVORITES);
  const favorites = ids.length ? (await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id) : [];
  const ordered = ids.filter((id) => favorites.includes(id));

  let shopPhoto: string | null | undefined;
  if (fd.get("removePhoto") === "1") shopPhoto = null;
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    if (!TYPES.includes(file.type) || file.size > 3 * 1024 * 1024) return { ok: false, error: "Photo : JPG, PNG ou WebP, 3 Mo au plus." };
    if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "L'envoi de photo n'est pas encore activé : réessayez plus tard." };
    const blob = await put(`consultants/${me.id}-${Date.now()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`, Buffer.from(await file.arrayBuffer()), { access: "public", addRandomSuffix: true, contentType: file.type });
    shopPhoto = blob.url;
  }

  const tf = fd.get("titleForm");
  const titleForm = tf === "m" || tf === "f" ? tf : null;
  await prisma.consultant.update({ where: { id: me.id }, data: { shopBio: bio, favorites: ordered, titleForm, ...(shopPhoto !== undefined ? { shopPhoto } : {}) } });
  if (me.slug) revalidatePath(`/c/${me.slug}`);
  revalidatePath("/admin/ma-boutique");
  return { ok: true, message: "Boutique enregistrée." };
}
