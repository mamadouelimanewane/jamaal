"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { logActivity } from "@/lib/activity-log";
import { parsePriceList, savePriceList } from "@/lib/price-list";

/** Nouvelle liste de prix PDF des revendeurs (fichier déjà envoyé sur le stockage). */
export async function setPriceList(url: string, title: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin("marketing");
  const list = parsePriceList(JSON.stringify({ url, title: title.trim() || "Liste de prix JAMAAL", updatedAt: new Date().toISOString().slice(0, 10) }));
  if (!list) return { ok: false, error: "Fichier PDF refusé." };
  await savePriceList(list);
  await logActivity(session, "UPDATE", "Setting", "reseller_price_list").catch(() => {});
  revalidatePath("/admin/catalogue");
  revalidatePath("/admin/kit-marketing");
  return { ok: true };
}
