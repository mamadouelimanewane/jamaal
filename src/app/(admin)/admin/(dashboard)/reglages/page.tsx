import { requireAdminPage } from "@/lib/admin-page-guard";
import { getCommissionRate, getLoyaltySettings } from "@/lib/settings";
import { updateCommissionRate, updateLoyaltySettingsAction } from "@/lib/actions/settings";
import { Settings, Percent, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage();
  const commissionRate = await getCommissionRate();
  const loyalty = await getLoyaltySettings();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Réglages système & Fidélité
          </h1>
          <p className="text-sm text-navy/60">
            Configurez les taux de commission réseau et les règles du programme de fidélité client.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Commission Revendeurs */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <Percent size={18} className="text-rose" />
            <h2>Taux de Commission Revendeurs</h2>
          </div>
          <p className="mt-1 text-xs text-navy/60">
            Pourcentage reversé par défaut à chaque revendeur sur son chiffre d&apos;affaires généré.
          </p>

          <form action={updateCommissionRate} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy/70">
                Taux de commission (%)
              </label>
              <input
                type="number"
                name="rate"
                defaultValue={commissionRate}
                step="0.5"
                min="0"
                max="100"
                required
                className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
            >
              Enregistrer le taux
            </button>
          </form>
        </div>

        {/* Programme de Fidélité */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <Gift size={18} className="text-amber-600" />
            <h2>Programme de Fidélité Clients</h2>
          </div>
          <p className="mt-1 text-xs text-navy/60">
            Définissez combien de points un client gagne par tranche d&apos;achat en FCFA.
          </p>

          <form action={updateLoyaltySettingsAction} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy/70">
                Points attribués par tranche
              </label>
              <input
                type="number"
                name="earningRate"
                defaultValue={loyalty.earningRate}
                min="1"
                required
                className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/70">
                Tranche d&apos;achat (en FCFA)
              </label>
              <input
                type="number"
                name="spendThreshold"
                defaultValue={loyalty.spendThreshold}
                min="1"
                step="50"
                required
                className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
              <span className="font-semibold">Règle actuelle :</span> {loyalty.earningRate} point(s) pour chaque {loyalty.spendThreshold.toLocaleString("fr-FR")} FCFA dépensé(s).
              <br />
              <span className="text-[11px] text-amber-700/80">
                (Ex: 10 000 FCFA d&apos;achat = {Math.floor(10000 / loyalty.spendThreshold) * loyalty.earningRate} points gagnés)
              </span>
            </div>

            <button
              type="submit"
              className="mt-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
            >
              Enregistrer les règles de fidélité
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
