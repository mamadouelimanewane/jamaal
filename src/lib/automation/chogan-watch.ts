/**
 * Synchronisation automatique avec Chogan : chaque jour (tâche du soir et tâche du matin), relit les fiches
 * les plus anciennement contrôlées, applique les nouveaux prix (prix public et prix de vente JAMAAL selon le
 * modèle économique), puis importe les nouveaux produits Chogan. L'équipe reçoit le récapitulatif sur WhatsApp.
 * Interrupteur : Admin › Automatisations › « Mise à jour automatique du catalogue Chogan ».
 */
import { revalidatePath } from "next/cache";
import { automationEnabled } from "@/lib/automation-settings";
import { syncChoganCatalog } from "@/lib/chogan/catalog-sync";
import { recordChoganSync } from "@/lib/chogan/sync-status";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";

export async function watchChoganPrices(budgetMs: number) {
  if (!(await automationEnabled("choganWatch"))) return "désactivé";
  const r = await syncChoganCatalog(budgetMs);
  await recordChoganSync({ source: "auto", verifies: r.verifies, prixMisAJour: r.prixMisAJour, nouveautes: r.nouveautes, erreurs: r.erreurs });
  if (r.prixMisAJour || r.nouveautes) {
    try {
      revalidatePath("/", "layout");
    } catch {
      // hors requête : les pages se mettent à jour à la prochaine visite
    }
    notifyTeamWhatsApp(`🔄 Catalogue Chogan mis à jour : ${r.prixMisAJour} prix, ${r.nouveautes} nouveau(x) produit(s).\n${r.details.slice(0, 8).join("\n")}${r.details.length > 8 ? "\n…" : ""}\nDétail : Admin › Stocks › Commande Chogan.`);
  }
  return { verifies: r.verifies, prix: r.prixMisAJour, nouveautes: r.nouveautes, sondes: r.sondes, erreurs: r.erreurs };
}
