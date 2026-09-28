/**
 * Remplacer le bloc "Taux de commission" unique dans
 * src/app/(admin)/admin/(dashboard)/comptabilite/page.tsx
 * par les deux formulaires ci-dessous.
 *
 * Imports à ajouter :
 *   import { updateCommissionRate, updateSponsorCommissionRate } from "@/lib/actions/settings";
 *   import { getCommissionRate, getSponsorCommissionRate } from "@/lib/settings";
 *
 * Dans le Promise.all de la page, ajouter :
 *   getSponsorCommissionRate(),
 * et récupérer sponsorRate.
 */

import { updateCommissionRate, updateSponsorCommissionRate } from "@/lib/actions/settings";

export function CommissionRatesForms({
  rate,
  sponsorRate,
}: {
  rate: number;
  sponsorRate: number;
}) {
  return (
    <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">
          Commission revendeur (ventes directes)
        </h2>
        <form
          action={updateCommissionRate}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              name="rate"
              min={0}
              max={100}
              step="0.1"
              defaultValue={rate}
              className="w-24 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <span className="text-sm text-navy/60">% du CA du consultant</span>
          </div>
          <button className="w-fit rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-light">
            Enregistrer
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">
          Commission parrainage (filleuls)
        </h2>
        <form
          action={updateSponsorCommissionRate}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              name="rate"
              min={0}
              max={100}
              step="0.1"
              defaultValue={sponsorRate}
              className="w-24 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <span className="text-sm text-navy/60">% du CA des filleuls</span>
          </div>
          <button className="w-fit rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-light">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
