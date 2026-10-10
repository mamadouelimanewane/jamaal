import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { labelFor } from "@/lib/accounting/chart";
import { dateFr } from "@/lib/accounting/format";
import { monthKeyOf, monthLabel, monthStart, monthsBetween, nextMonth, totalsBy } from "@/lib/accounting/reports";
import { closeMonthAction, reopenMonthAction } from "@/lib/actions/accounting";
import { Amount, btn, Card, field, td, tdr, th, thr } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";

type Snap = { entries?: number; totals?: Record<string, [number, number]> };

export default async function CloturesPage({ searchParams }: { searchParams: SP }) {
  const { L } = await accountingContext(searchParams);
  const now = new Date();
  const last = monthKeyOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const months = monthsBetween(monthKeyOf(L.start), last).reverse();
  const periods = new Map(L.periods.map((p) => [p.month, p]));
  const firstOpen = [...months].reverse().find((m) => !periods.has(m));

  // Écarts depuis la clôture : opérations modifiées à la source (retour tardif, correction…)
  const drift = L.periods.map((p) => {
    const snap = (p.snapshot ?? {}) as Snap;
    const live = totalsBy(L.entries, (e) => e.date >= monthStart(p.month) && e.date < monthStart(nextMonth(p.month)));
    const codes = new Set([...Object.keys(snap.totals ?? {}), ...live.keys()]);
    const diffs = [...codes]
      .map((c) => {
        const [d, cr] = snap.totals?.[c] ?? [0, 0];
        const l = live.get(c) ?? { debit: 0, credit: 0 };
        return { account: c, delta: l.debit - l.credit - (d - cr) };
      })
      .filter((x) => x.delta !== 0);
    return { month: p.month, diffs };
  }).filter((d) => d.diffs.length);

  return (
    <div className="space-y-6">
      <h2 className="font-serif-display text-xl font-semibold text-navy">Clôtures mensuelles</h2>
      <p className="text-sm text-navy/75">Clôturer un mois fige les saisies (dépenses, écritures, comptages, remboursements) datées de ce mois et garde une photo des soldes. À faire chaque mois, une fois les dépenses et le comptage de caisse saisis.</p>

      {drift.length > 0 && (
        <Card title="Écarts depuis la clôture">
          <p className="mb-2 text-sm text-amber-950">Des opérations automatiques ont changé dans un mois clôturé (ex. un retour remboursé ou une commande annulée après coup). Vérifiez, puis rouvrez et reclôturez le mois pour valider.</p>
          {drift.map((d) => (
            <div key={d.month} className="mt-2">
              <p className="text-sm font-semibold capitalize text-navy">{monthLabel(d.month)}</p>
              <ul className="text-sm">{d.diffs.map((x) => <li key={x.account} className="flex justify-between border-b border-line/60 py-1"><span>{x.account} · {labelFor(x.account, L.accounts)}</span><Amount value={x.delta} /></li>)}</ul>
            </div>
          ))}
        </Card>
      )}

      {firstOpen && (
        <Card title="Clôturer un mois">
          <form action={closeMonthAction} className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
            <select name="month" defaultValue={firstOpen} className={field} aria-label="Mois">
              {months.filter((m) => !periods.has(m)).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <input name="note" placeholder="Note (facultatif) : ex. caisse comptée, relevés Wave vérifiés" className={field} />
            <button className={btn}>Clôturer</button>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream"><tr><th className={th}>Mois</th><th className={th}>État</th><th className={thr}>Écritures</th><th className={th}>Note</th><th className={th}></th></tr></thead>
          <tbody>
            {months.map((m) => {
              const p = periods.get(m);
              const count = L.entries.filter((e) => e.date >= monthStart(m) && e.date < monthStart(nextMonth(m))).length;
              return (
                <tr key={m} className="border-t border-line">
                  <td className={`${td} capitalize`}>{monthLabel(m)}</td>
                  <td className={td}>{p ? <span className="text-emerald-800">Clôturé le {dateFr(p.closedAt)}</span> : <span className="text-amber-700">Ouvert</span>}</td>
                  <td className={tdr}>{count}</td>
                  <td className={`${td} text-xs text-navy/70`}>{p?.note ?? ""}</td>
                  <td className={td}>{p && <form action={reopenMonthAction.bind(null, m)}><button className="text-xs font-semibold text-red-700 hover:underline">Rouvrir</button></form>}</td>
                </tr>
              );
            })}
            {!months.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-navy/70">Aucun mois terminé pour l&apos;instant.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
