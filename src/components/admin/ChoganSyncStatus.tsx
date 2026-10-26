import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { frDateTime, getChoganSyncStatus } from "@/lib/chogan/sync-status";
import { syncChoganNow } from "@/lib/actions/chogan-sync";
import { RowAction } from "./RowAction";

/** Encart « Dernière mise à jour Chogan » avec le bouton pour la lancer tout de suite. */
export async function ChoganSyncStatus({ detailsLink = true }: { detailsLink?: boolean }) {
  const s = await getChoganSyncStatus();
  const l = s.last;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm print:hidden">
      <div className="min-w-0 text-navy/85">
        <p className="flex items-center gap-1.5 font-semibold text-navy">
          <RefreshCw size={15} /> Dernière mise à jour Chogan : {s.lastAt ? frDateTime(s.lastAt) : "jamais"}
          {l && <span className="font-normal text-navy/60">({l.source === "auto" ? "automatique" : "manuelle"})</span>}
        </p>
        <p className="mt-0.5 text-xs text-navy/65">
          {l ? `${l.verifies} fiche(s) vérifiée(s), ${l.prixMisAJour} prix mis à jour, ${l.nouveautes} nouveauté(s)${l.erreurs ? `, ${l.erreurs} erreur(s) de lecture` : ""} · ` : ""}
          {s.checked30} / {s.linked} fiches Chogan vérifiées sur 30 jours
          {s.lastImport && ` · dernier produit ajouté : ${s.lastImport.name} (${s.lastImport.createdAt.toLocaleDateString("fr-FR")})`}
          {s.lastPrice && ` · dernier changement de prix : ${s.lastPrice.name} (${s.lastPrice.detectedAt.toLocaleDateString("fr-FR")})`}
          {detailsLink && <> · <Link href="/admin/stocks/commande-chogan" className="underline">détail</Link></>}
        </p>
      </div>
      <RowAction label="Mettre à jour depuis Chogan" run={syncChoganNow} />
    </div>
  );
}
