import Link from "next/link";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { labelFor } from "@/lib/accounting/chart";
import { fcfa, pct } from "@/lib/accounting/format";
import { monthKeyOf, monthLabel, monthStart, monthsBetween, nextMonth, solde, totalsBy } from "@/lib/accounting/reports";
import { saveBudgetsAction } from "@/lib/actions/accounting";
import { prisma } from "@/lib/prisma";
import { Amount, btn, btnLight, Card, td, tdr, th, thr } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";

const BUDGET_ACCOUNTS = ["701", "7071", "601", "6322", "612", "605", "618", "622", "624", "625", "627", "628", "631", "6324", "638", "641", "658", "661", "664", "671"];
const isProduct = (c: string) => c.startsWith("7");

export default async function BudgetsPage({ searchParams }: { searchParams: SP }) {
  const { L, get } = await accountingContext(searchParams);
  const m = /^\d{4}-\d{2}$/.test(get("mois")) ? get("mois") : monthKeyOf(new Date());
  const year = m.slice(0, 4);
  const [budgets, yearBudgets] = await Promise.all([
    prisma.budget.findMany({ where: { month: m } }),
    prisma.budget.findMany({ where: { month: { startsWith: year } } }),
  ]);
  const custom = L.settings.customAccounts.map((a) => a.code).filter((c) => /^[67]/.test(c));
  const accounts = [...new Set([...BUDGET_ACCOUNTS, ...custom, ...budgets.map((b) => b.account)])];
  const bOf = new Map(budgets.map((b) => [b.account, b.amount]));
  const real = totalsBy(L.entries, (e) => e.date >= monthStart(m) && e.date < monthStart(nextMonth(m)));
  const realOf = (c: string) => (isProduct(c) ? -solde(real.get(c)) : solde(real.get(c)));
  const prev = monthKeyOf(new Date(Date.UTC(Number(year), Number(m.slice(5)) - 2, 1)));
  const next = nextMonth(m);

  // Récapitulatif annuel : charges budgétées vs réelles
  const months = monthsBetween(`${year}-01`, `${year}-12`);
  const summary = months.map((k) => {
    const t = totalsBy(L.entries, (e) => e.date >= monthStart(k) && e.date < monthStart(nextMonth(k)));
    const bud = yearBudgets.filter((b) => b.month === k);
    return {
      month: k,
      budgetCharges: bud.filter((b) => !isProduct(b.account)).reduce((s, b) => s + b.amount, 0),
      budgetSales: bud.filter((b) => isProduct(b.account)).reduce((s, b) => s + b.amount, 0),
      charges: [...t].filter(([c]) => c.startsWith("6") && c !== "6031").reduce((s, [, v]) => s + v.debit - v.credit, 0),
      sales: -[...t].filter(([c]) => c.startsWith("70")).reduce((s, [, v]) => s + v.debit - v.credit, 0),
    };
  });
  const totalBudgetCharges = accounts.filter((c) => !isProduct(c)).reduce((s, c) => s + (bOf.get(c) ?? 0), 0);
  const totalRealCharges = accounts.filter((c) => !isProduct(c)).reduce((s, c) => s + realOf(c), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif-display text-xl font-semibold capitalize text-navy">Budget · {monthLabel(m)}</h2>
        <div className="flex gap-2">
          <Link href={`/admin/comptabilite/budgets?mois=${prev}`} className={btnLight}>← Mois précédent</Link>
          <Link href={`/admin/comptabilite/budgets?mois=${next}`} className={btnLight}>Mois suivant →</Link>
        </div>
      </div>
      <p className="text-sm text-navy/75">Fixez un objectif de ventes et un plafond pour chaque poste de charge : le réel du mois s&apos;affiche en face. Charges : {fcfa(totalRealCharges)} dépensés sur {fcfa(totalBudgetCharges)} prévus.</p>

      <form action={saveBudgetsAction} className="space-y-3">
        <input type="hidden" name="month" value={m} />
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream"><tr><th className={th}>Poste</th><th className={thr}>Budget (F)</th><th className={thr}>Réel</th><th className={thr}>Écart</th><th className={th}>Avancement</th></tr></thead>
            <tbody>
              {accounts.map((c) => {
                const b = bOf.get(c) ?? 0;
                const r = realOf(c);
                const ratio = b ? r / b : 0;
                const good = isProduct(c) ? r >= b : r <= b;
                return (
                  <tr key={c} className="border-t border-line">
                    <td className={td}><span className="font-mono text-xs">{c}</span> {labelFor(c, L.accounts)}{isProduct(c) && <span className="ml-1 rounded bg-emerald-50 px-1.5 text-[11px] text-emerald-800">objectif</span>}</td>
                    <td className={tdr}><input name={`b_${c}`} defaultValue={b || ""} inputMode="numeric" aria-label={`Budget ${c}`} className="w-28 rounded-lg border border-line px-2 py-1 text-right text-sm" /></td>
                    <td className={tdr}><Amount value={r} /></td>
                    <td className={`${tdr} ${b ? (good ? "text-emerald-700" : "text-red-700") : ""}`}>{b ? <Amount value={isProduct(c) ? r - b : b - r} /> : ""}</td>
                    <td className={td}>
                      {b > 0 && (
                        <div className="flex min-w-28 items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream"><div className={`h-full rounded-full ${good ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} /></div>
                          <span className="text-xs text-navy/75">{pct(r, b)}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy"><input type="checkbox" name="year" /> Appliquer ces montants à tous les mois jusqu&apos;à décembre {year}</label>
        <button className={btn}>Enregistrer le budget</button>
      </form>

      <Card title={`Année ${year}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream"><tr><th className={th}>Mois</th><th className={thr}>Ventes prévues</th><th className={thr}>Ventes réelles</th><th className={thr}>Charges prévues</th><th className={thr}>Charges réelles</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.month} className="border-t border-line">
                  <td className={`${td} capitalize`}><Link href={`/admin/comptabilite/budgets?mois=${s.month}`} className="hover:underline">{monthLabel(s.month)}</Link></td>
                  <td className={tdr}><Amount value={s.budgetSales} blankZero /></td>
                  <td className={`${tdr} ${s.budgetSales && s.sales < s.budgetSales ? "text-red-700" : ""}`}><Amount value={s.sales} blankZero /></td>
                  <td className={tdr}><Amount value={s.budgetCharges} blankZero /></td>
                  <td className={`${tdr} ${s.budgetCharges && s.charges > s.budgetCharges ? "text-red-700" : ""}`}><Amount value={s.charges} blankZero /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
