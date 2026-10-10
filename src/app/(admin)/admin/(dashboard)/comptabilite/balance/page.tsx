import Link from "next/link";
import { Fragment } from "react";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { CLASS_LABELS, labelFor } from "@/lib/accounting/chart";
import { trialBalance, type BalanceRow } from "@/lib/accounting/reports";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btnLight, td, tdr, th, thr } from "@/components/accounting/ui";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

const sum = (rows: BalanceRow[]) =>
  rows.reduce((s, r) => ({ openDebit: s.openDebit + r.openDebit, openCredit: s.openCredit + r.openCredit, debit: s.debit + r.debit, credit: s.credit + r.credit, closeDebit: s.closeDebit + r.closeDebit, closeCredit: s.closeCredit + r.closeCredit }), { openDebit: 0, openCredit: 0, debit: 0, credit: 0, closeDebit: 0, closeCredit: 0 });

function Cells({ r, strong = false }: { r: Omit<BalanceRow, "account">; strong?: boolean }) {
  return (
    <>
      <td className={tdr} data-label="À nouveau débit"><Amount value={r.openDebit} blankZero strong={strong} /></td>
      <td className={tdr} data-label="À nouveau crédit"><Amount value={r.openCredit} blankZero strong={strong} /></td>
      <td className={tdr} data-label="Débit"><Amount value={r.debit} blankZero strong={strong} /></td>
      <td className={tdr} data-label="Crédit"><Amount value={r.credit} blankZero strong={strong} /></td>
      <td className={tdr} data-label="Solde débiteur"><Amount value={r.closeDebit} blankZero strong={strong} /></td>
      <td className={tdr} data-label="Solde créditeur"><Amount value={r.closeCredit} blankZero strong={strong} /></td>
    </>
  );
}

export default async function BalancePage({ searchParams }: { searchParams: SP }) {
  const { L, period, query } = await accountingContext(searchParams);
  const rows = trialBalance(L.entries, period);
  const classes = [...new Set(rows.map((r) => r.account[0]))].sort();
  const total = sum(rows);
  const ok = total.closeDebit === total.closeCredit && total.debit === total.credit;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif-display text-xl font-semibold text-navy">Balance générale <span className="text-base font-normal text-navy/70">· {period.label || `${period.fromStr} → ${period.toStr}`}</span></h2>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={`/api/export/comptabilite?type=balance&${query}`} className={btnLight}>Excel ↓</a>
          <PrintButton />
        </div>
      </div>
      <PeriodPicker path="/admin/comptabilite/balance" period={period} />
      <p className={`rounded-xl px-3 py-2 text-sm ${ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>{ok ? "Balance équilibrée : total des débits = total des crédits." : "Attention : la balance n'est pas équilibrée."}</p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-cream">
            <tr><th className={th} rowSpan={2}>Compte</th><th className={`${thr} text-center`} colSpan={2}>À nouveau</th><th className={`${thr} text-center`} colSpan={2}>Mouvements</th><th className={`${thr} text-center`} colSpan={2}>Soldes</th></tr>
            <tr><th className={thr}>Débit</th><th className={thr}>Crédit</th><th className={thr}>Débit</th><th className={thr}>Crédit</th><th className={thr}>Débiteur</th><th className={thr}>Créditeur</th></tr>
          </thead>
          <tbody>
            {classes.map((c) => {
              const cr = rows.filter((r) => r.account[0] === c);
              return (
                <Fragment key={c}>
                  {cr.map((r) => (
                    <tr key={r.account} className="border-t border-line">
                      <td className={td}><Link href={`/admin/comptabilite/grand-livre?compte=${r.account}&${query}`} className="hover:underline"><span className="font-mono text-xs">{r.account}</span> {labelFor(r.account, L.accounts)}</Link></td>
                      <Cells r={r} />
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-cream/60">
                    <td className={`${td} font-semibold`}>Total classe {c} · {CLASS_LABELS[c]}</td>
                    <Cells r={sum(cr)} strong />
                  </tr>
                </Fragment>
              );
            })}
            <tr className="border-t-2 border-navy/30 bg-navy/5">
              <td className={`${td} font-bold`}>TOTAL GÉNÉRAL</td>
              <Cells r={total} strong />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-navy/65">À nouveau : soldes des comptes de bilan avant la période ; pour les charges et produits, cumul depuis le 1er janvier de l&apos;exercice.</p>
    </div>
  );
}
