import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { balanceSheet } from "@/lib/accounting/reports";
import { fmt } from "@/lib/accounting/period";
import { ASSET_ROWS, LIABILITY_ROWS, type SheetRow } from "@/lib/accounting/statements";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btnLight, td, tdr, th, thr } from "@/components/accounting/ui";
import { PrintButton } from "@/components/admin/PrintButton";
import type { BalanceSheet } from "@/lib/accounting/reports";

export const dynamic = "force-dynamic";

function Side({ title, rows, cur, prev, prevLabel }: { title: string; rows: SheetRow[]; cur: BalanceSheet; prev: BalanceSheet; prevLabel: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <table className="keep-table w-full text-sm">
        <thead className="bg-cream">
          <tr><th className={th}>{title}</th><th className={thr}>Montant</th><th className={thr}>{prevLabel}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={`border-t border-line ${r.total ? "bg-cream/70 font-semibold" : ""}`}>
              <td className={`${td} ${r.sub ? "pl-6 text-xs italic text-navy/75" : ""}`}>{r.label}</td>
              <td className={tdr}><Amount value={r.get(cur)} strong={r.total} /></td>
              <td className={`${tdr} text-navy/70`}><Amount value={r.get(prev)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function BilanPage({ searchParams }: { searchParams: SP }) {
  const { L, period, query } = await accountingContext(searchParams, "annee");
  const now = new Date();
  const at = period.to > now ? new Date(now.getTime() + 1000) : period.to;
  const cur = balanceSheet(L.entries, at);
  const prevAt = new Date(Date.UTC(new Date(at.getTime() - 1).getUTCFullYear(), 0, 1));
  const prev = balanceSheet(L.entries, prevAt);
  const prevLabel = `31/12/${prevAt.getUTCFullYear() - 1}`;
  const c = L.settings.company;
  const ok = cur.totalActif === cur.totalPassif;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif-display text-xl font-semibold text-navy">Bilan au {fmt(new Date(at.getTime() - 1))}</h2>
          <p className="text-sm text-navy/75">{c.name}{c.ninea && ` · NINEA ${c.ninea}`}{c.rccm && ` · RCCM ${c.rccm}`} · exercice {cur.fiscalYear}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={`/api/export/comptabilite?type=bilan&${query}`} className={btnLight}>Excel ↓</a>
          <PrintButton />
        </div>
      </div>
      <PeriodPicker path="/admin/comptabilite/bilan" period={period} />
      <p className={`rounded-xl px-3 py-2 text-sm ${ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
        {ok ? "Le bilan est équilibré : total actif = total passif." : `Écart actif / passif : ${(cur.totalActif - cur.totalPassif).toLocaleString("fr-FR")} F.`}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Side title="Actif" rows={ASSET_ROWS} cur={cur} prev={prev} prevLabel={prevLabel} />
        <Side title="Passif" rows={LIABILITY_ROWS} cur={cur} prev={prev} prevLabel={prevLabel} />
      </div>
      <p className="text-xs text-navy/65">
        Le stock est valorisé au prix d&apos;achat Chogan (prix public × part achat du modèle économique). Les wallets sont l&apos;argent dû aux revendeurs et livreurs ; les avances clients, l&apos;argent reçu pour des commandes pas encore vendues (acomptes, commandes annulées à rembourser).
      </p>
    </div>
  );
}
