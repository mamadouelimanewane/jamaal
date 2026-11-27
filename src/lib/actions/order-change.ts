"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { searchCatalog } from "@/lib/search-index";
import { sellableVolumes } from "@/lib/price-from";
import { replaceOrderItem, type ReplaceActor } from "@/lib/orders/replace-item";
import { requireAdmin, requireConsultantProfile } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";

export type ReplacementOption = { id: string; name: string; photo: string | null; formats: { label: string; price: number; inStock: boolean }[] };

/** Produits proposés pour remplacer un article : formats vendus, prix et disponibilité. */
export async function searchReplacementProducts(q: string): Promise<ReplacementOption[]> {
  const query = String(q ?? "").trim().slice(0, 60);
  if (query.length < 2) return [];
  const limited = await rateLimit(`replace-search:${clientIpFromHeaders(await headers())}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return [];
  const r = await searchCatalog(query, 12);
  const ids = r.hits.map((h) => h.doc.id);
  if (!ids.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, photo: true, stock: true, regularPrice: true, volumes: true, variants: { select: { volumeLabel: true, stock: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => {
      const volumes = (p.volumes as { label: string; price: number }[] | null) ?? [];
      const list = volumes.length ? sellableVolumes(volumes) : p.regularPrice != null ? [{ label: "Format unique", price: p.regularPrice }] : [];
      const stockOf = (label: string) => (p.variants.length ? (p.variants.find((v) => v.volumeLabel === label)?.stock ?? 0) : p.stock);
      return { id: p.id, name: p.name, photo: p.photo, formats: list.map((v) => ({ label: v.label, price: v.price, inStock: stockOf(v.label) > 0 })) };
    })
    .filter((p) => p.formats.length > 0)
    .slice(0, 8);
}

type Result = { ok: true; message: string } | { ok: false; error: string };

function refresh(orderId: string) {
  for (const p of [`/commande/${orderId}`, `/suivi/${orderId}`, `/admin/commandes/${orderId}`, `/admin/mes-commandes/${orderId}`, "/admin/commandes", "/admin/mes-commandes"]) {
    try {
      revalidatePath(p);
    } catch {
      // hors requête : sans effet
    }
  }
}

async function run(orderId: string, itemId: string, productId: string, volumeLabel: string, actor: ReplaceActor): Promise<Result> {
  const r = await replaceOrderItem({ orderId: String(orderId).slice(0, 40), itemId: String(itemId).slice(0, 40), productId: String(productId).slice(0, 40), volumeLabel: String(volumeLabel).slice(0, 60), actor });
  if (!r.ok) return r;
  refresh(orderId);
  return { ok: true, message: r.message };
}

/** Client, depuis le lien de sa commande (page /commande/…). */
export async function replaceItemAsClient(orderId: string, itemId: string, productId: string, volumeLabel: string): Promise<Result> {
  const limited = await rateLimit(`replace:${clientIpFromHeaders(await headers())}`, { limit: 10, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Trop de modifications : réessayez dans une heure ou contactez JAMAAL sur WhatsApp." };
  return run(orderId, itemId, productId, volumeLabel, { role: "CLIENT", name: null });
}

/** Revendeur, sur une de ses commandes. */
export async function replaceItemAsReseller(orderId: string, itemId: string, productId: string, volumeLabel: string): Promise<Result> {
  try {
    const { consultant } = await requireConsultantProfile();
    return run(orderId, itemId, productId, volumeLabel, { role: "REVENDEUR", name: consultant.name, consultantId: consultant.id });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Admin (Commandes). */
export async function replaceItemAsAdmin(orderId: string, itemId: string, productId: string, volumeLabel: string): Promise<Result> {
  try {
    const session = await requireAdmin("commandes");
    const r = await run(orderId, itemId, productId, volumeLabel, { role: "ADMIN", name: session.user?.name ?? null });
    if (r.ok) await logActivity(session, `Produit remplacé · commande ${orderId.slice(-8).toUpperCase()}`, "Order", orderId).catch(() => {});
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Le client annule sa réservation depuis sa page de commande (somme payée rendue dans son avoir, pénalité éventuelle). */
export async function cancelMyReservation(orderId: string): Promise<Result> {
  const limited = await rateLimit(`resa-cancel:${clientIpFromHeaders(await headers())}`, { limit: 5, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Trop de tentatives : réessayez dans une heure ou contactez JAMAAL sur WhatsApp." };
  const { cancelReservation } = await import("@/lib/orders/reservation-cancel");
  const r = await cancelReservation(String(orderId).slice(0, 40), { byCustomer: true });
  if (!r.ok) return r;
  refresh(orderId);
  revalidatePath("/admin/reservations");
  return { ok: true, message: r.message };
}
