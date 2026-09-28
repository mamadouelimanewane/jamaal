/**
 * À ajouter dans ConsultantOverview, à côté de la carte commission directe.
 * `commission` vient déjà de getConsultantCommission().
 */

import { formatPrice } from "@/lib/currency";

export function SponsorCommissionCard({
  commission,
}: {
  commission: {
    sponsorRate: number;
    monthlySponsorCommission: number;
    lifetimeSponsorCommission: number;
    monthlyTeamRevenue: number;
  };
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">
        Parrainage ({commission.sponsorRate}%)
      </p>
      <p className="mt-2 text-2xl font-semibold text-navy">
        {formatPrice(commission.monthlySponsorCommission)}
      </p>
      <p className="text-xs text-navy/50">ce mois-ci sur l&apos;équipe</p>
      <p className="mt-3 text-sm text-navy/70">
        CA équipe : {formatPrice(commission.monthlyTeamRevenue)}
        <br />
        Total parrainage :{" "}
        <span className="font-semibold">{formatPrice(commission.lifetimeSponsorCommission)}</span>
      </p>
    </div>
  );
}
