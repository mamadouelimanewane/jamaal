"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { syncChoganCatalog } from "@/lib/chogan/catalog-sync";

/** « Mettre à jour maintenant » : prix et nouveautés Chogan, dans la limite de 30 secondes. */
export async function syncChoganNow(): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdmin("catalogue");
  const r = await syncChoganCatalog(30_000, { maxImports: 3 });
  await logActivity(session, `Mise à jour Chogan : ${r.prixMisAJour} prix, ${r.nouveautes} nouveautés`, "Product", "chogan");
  revalidatePath("/admin/stocks/commande-chogan");
  revalidatePath("/admin/produits");
  return {
    ok: r.verifies > 0 || r.erreurs === 0,
    message: `${r.verifies} fiche(s) vérifiée(s), ${r.prixMisAJour} prix mis à jour, ${r.nouveautes} nouveau(x) produit(s) importé(s)${r.erreurs ? `, ${r.erreurs} erreur(s) de lecture` : ""}.${r.details.length ? ` ${r.details.slice(0, 5).join(" · ")}` : ""}`,
  };
}
