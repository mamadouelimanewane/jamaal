import Link from "next/link";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { fcfa } from "@/lib/accounting/format";
import { monthKeyOf, monthLabel, monthsBetween, solde, totalsBy, vatByMonth } from "@/lib/accounting/reports";
import { declareVatAction } from "@/lib/actions/accounting";
import { Amount, btn, Card, td, tdr, th, thr } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";

export default async function TvaPage({ searchParams }: { searchParams: SP }) {
  const { L } = await accountingContext(searchParams);
  const s = L.settings;
  const now = new Date();
  const months = monthsBetween(monthKeyOf(L.start), monthKeyOf(now)).slice(-24).reverse();
  const declared = new Set(L.entries.filter((e) => e.ref?.startsWith("TVA-")).map((e) => e.ref!.slice(4)));
  const rows = vatByMonth(L.entries, months, declared);
  const t = totalsBy(L.entries, (e) => e.date < new Date(now.getTime() + 1000));
  const due = -solde(t.get("4441"));
  const credit = solde(t.get("4449"));
  const current = monthKeyOf(now);

  return (
    <div className="space-y-6">
      <h2 className="font-serif-display text-xl font-semibold text-navy">TVA</h2>
      {!s.vatEnabled && (
        <Card>
          <p className="text-sm text-navy">
            La TVA n&apos;est pas activée : JAMAAL est considéré comme non assujetti (régime {s.company.regime}). Les ventes sont comptées TTC et la TVA des factures fournisseurs reste une charge.
            Si JAMAAL est assujetti (réel normal ou simplifié, TVA 18 % au Sénégal), activez-la dans <Link href="/admin/comptabilite/reglages" className="font-semibold underline">Réglages</Link>.
          </p>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-navy/70">TVA déclarée restant à payer (4441)</p><p className="text-xl font-semibold text-red-700">{fcfa(due)}</p><p className="mt-1 text-xs text-navy/65">Paiement : saisir une dépense sur le compte 4441.</p></Card>
        <Card><p className="text-xs text-navy/70">Crédit de TVA à reporter (4449)</p><p className="text-xl font-semibold">{fcfa(credit)}</p></Card>
        <Card><p className="text-xs text-navy/70">Taux appliqué</p><p className="text-xl font-semibold">{s.vatEnabled ? `${s.vatRate} %` : "—"}</p></Card>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream"><tr><th className={th}>Mois</th><th className={thr}>TVA collectée</th><th className={thr}>TVA récupérable</th><th className={thr}>À payer (crédit si négatif)</th><th className={th}>Déclaration</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-t border-line">
                <td className={`${td} capitalize`}>{monthLabel(r.month)}</td>
                <td className={tdr}><Amount value={r.collected} /></td>
                <td className={tdr}><Amount value={r.deductible} /></td>
                <td className={tdr}><Amount value={r.due} strong /></td>
                <td className={td}>
                  {r.declared ? (
                    <span className="text-emerald-800">Déclarée ✓</span>
                  ) : r.month >= current ? (
                    <span className="text-xs text-navy/60">Mois en cours</span>
                  ) : r.collected || r.deductible ? (
                    <form action={declareVatAction}><input type="hidden" name="month" value={r.month} /><button className={`${btn} px-3 py-1 text-xs`}>Enregistrer la déclaration</button></form>
                  ) : (
                    <span className="text-xs text-navy/60">Rien à déclarer</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-navy/65">La déclaration solde la TVA collectée et récupérable du mois vers « État, TVA due » (ou en crédit à reporter). Au Sénégal, la déclaration et le paiement se font au plus tard le 15 du mois suivant (e-tax DGID).</p>
    </div>
  );
}
