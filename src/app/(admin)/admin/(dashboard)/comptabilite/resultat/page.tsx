import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { previousPeriod, fmt } from "@/lib/accounting/period";
import { incomeStatement, monthKeyOf, monthLabel, monthStart, monthsBetween, nextMonth, totalsBy } from "@/lib/accounting/reports";
import { pct } from "@/lib/accounting/format";
import { INCOME_ROWS } from "@/lib/accounting/statements";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btnLight, td, tdr, th, thr } from "@/components/accounting/ui";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function ResultatPage({ searchParams }: { searchParams: SP }) {
  const { L, period, query } = await accountingContext(searchParams, "annee");
  const prev = previousPeriod(period);
  const cur = incomeStatement(totalsBy(L.entries, (e) => e.date >= period.from && e.date < period.to));
  const before = incomeStatement(totalsBy(L.entries, (e) => e.date >= prev.from && e.date < prev.to));
  const months = monthsBetween(monthKeyOf(period.from), monthKeyOf(new Date(period.to.getTime() - 1)));
  const monthly = months.length <= 24 ? months.map((m) => ({ m, s: incomeStatement(totalsBy(L.entries, (e) => e.date >= monthStart(m) && e.date < monthStart(nextMonth(m)))) })) : [];
  const c = L.settings.company;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif-display text-xl font-semibold text-navy">Compte de résultat</h2>
          <p className="text-sm text-navy/75">{c.name}{c.ninea && ` · NINEA ${c.ninea}`} · du {fmt(period.from)} au {fmt(new Date(period.to.getTime() - 1))}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={`/api/export/comptabilite?type=resultat&${query}`} className={btnLight}>Excel ↓</a>
          <PrintButton />
        </div>
      </div>
      <PeriodPicker path="/admin/comptabilite/resultat" period={period} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="keep-table w-full text-sm">
          <thead className="bg-cream">
            <tr>
              <th className={`${th} hidden sm:table-cell`}>Réf.</th>
              <th className={th}>Libellé</th>
              <th className={thr}>Période</th>
              <th className={thr}><span className="hidden sm:inline">Période précédente</span><span className="sm:hidden">Préc.</span></th>
              <th className={`${thr} hidden md:table-cell`}>% CA</th>
            </tr>
          </thead>
          <tbody>
            {INCOME_ROWS.map((r) => {
              const v = r.get(cur);
              const p = r.get(before);
              return (
                <tr key={r.label} className={`border-t border-line ${r.total ? "bg-cream/70 font-semibold" : ""}`}>
                  <td className={`${td} hidden font-mono text-xs sm:table-cell`}>{r.ref}</td>
                  <td className={`${td} ${r.sub ? "pl-6 text-xs italic text-navy/75" : ""}`}>{r.label}</td>
                  <td className={tdr}><Amount value={v} strong={r.total} /></td>
                  <td className={`${tdr} text-navy/70`}><Amount value={p} /></td>
                  <td className={`${tdr} hidden text-xs text-navy/70 md:table-cell`}>{r.total || !r.sub ? pct(v, cur.chiffreAffaires) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-navy/65">Période précédente : du {fmt(prev.from)} au {fmt(new Date(prev.to.getTime() - 1))}. Montants en FCFA ; les charges sont en négatif.</p>

      {monthly.length > 1 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white print:break-before-page">
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr><th className={th}>Mois</th><th className={thr}>Chiffre d&apos;affaires</th><th className={thr}>Marge commerciale</th><th className={thr}>Commissions</th><th className={thr}>EBE</th><th className={thr}>Résultat net</th></tr>
            </thead>
            <tbody>
              {monthly.map(({ m, s }) => (
                <tr key={m} className="border-t border-line">
                  <td className={`${td} capitalize`}>{monthLabel(m)}</td>
                  <td className={tdr}><Amount value={s.chiffreAffaires} /></td>
                  <td className={tdr}><Amount value={s.margeCommerciale} /></td>
                  <td className={tdr}><Amount value={-s.commissionsReseau} /></td>
                  <td className={tdr}><Amount value={s.ebe} /></td>
                  <td className={tdr}><Amount value={s.resultatNet} strong /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
