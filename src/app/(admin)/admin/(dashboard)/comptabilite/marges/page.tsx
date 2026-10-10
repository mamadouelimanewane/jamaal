import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { marginReport, type MarginRow } from "@/lib/accounting/margins";
import { fcfa, pct } from "@/lib/accounting/format";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btnLight, Card, Kpi, td, tdr, th, thr } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";

function Table({ title, head, rows, limit = 50, showQty = true }: { title: string; head: string; rows: MarginRow[]; limit?: number; showQty?: boolean }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream">
            <tr>
              <th className={th}>{head}</th>
              {showQty && <th className={thr}>Qté</th>}
              <th className={thr}>Ventes nettes</th>
              <th className={thr}>Coût d&apos;achat</th>
              <th className={thr}>Commissions</th>
              <th className={thr}>Marge</th>
              <th className={thr}>Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className={td}>{r.label}{r.sub && <span className="text-navy/65"> · {r.sub}</span>}</td>
                {showQty && <td className={tdr}>{r.qty}</td>}
                <td className={tdr}><Amount value={r.revenue} /></td>
                <td className={tdr}><Amount value={-r.cost} /></td>
                <td className={tdr}><Amount value={-r.commissions} /></td>
                <td className={tdr}><Amount value={r.margin} strong /></td>
                <td className={`${tdr} ${r.margin < 0 ? "text-red-700" : "text-navy/80"}`}>{pct(r.margin, r.revenue)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-3 py-5 text-center text-navy/70">Aucune vente sur la période.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <p className="mt-2 text-xs text-navy/65">{rows.length - limit} ligne(s) de plus dans l&apos;export Excel.</p>}
    </Card>
  );
}

export default async function MargesPage({ searchParams }: { searchParams: SP }) {
  const { period, query } = await accountingContext(searchParams);
  const r = await marginReport(period);
  const t = r.totals;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif-display text-xl font-semibold text-navy">Rentabilité des ventes</h2>
        <a href={`/api/export/comptabilite?type=marges&${query}`} className={btnLight}>Excel ↓</a>
      </div>
      <PeriodPicker path="/admin/comptabilite/marges" period={period} />
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Ventes nettes" value={t.revenue} hint={`${t.orders} commande(s), retours déduits`} />
        <Kpi label="Coût d'achat" value={t.cost} hint={`${r.purchasePct} % du prix public Chogan`} tone="amber" />
        <Kpi label="Marge brute" value={t.revenue - t.cost} hint={pct(t.revenue - t.cost, t.revenue)} tone="green" />
        <Kpi label="Commissions réseau" value={t.commissions} hint={pct(t.commissions, t.revenue)} tone="amber" />
        <Kpi label="Marge après commissions" value={t.margin} hint={pct(t.margin, t.revenue)} tone={t.margin >= 0 ? "green" : "red"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Livraison">
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between"><span>Frais de livraison facturés</span><strong>{fcfa(r.delivery.billed)}</strong></li>
            <li className="flex justify-between"><span>Parts versées aux livreurs</span><strong className="text-red-700">−{fcfa(r.delivery.livreurs)}</strong></li>
            <li className="flex justify-between border-t border-line pt-1.5"><span>Marge de livraison</span><strong className={r.delivery.margin < 0 ? "text-red-700" : "text-emerald-700"}>{fcfa(r.delivery.margin)}</strong></li>
          </ul>
        </Card>
        <Card title="À savoir">
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-navy/80">
            <li>Ventes comptées à l&apos;encaissement (ou à la livraison pour le paiement à la livraison), comme les commissions.</li>
            <li>Coût d&apos;achat théorique ; la marge comptable (compte de résultat) se fonde sur les achats réels et la variation de stock.</li>
            {r.estimatedCost > 0 && <li>{r.estimatedCost} article(s) sans prix public Chogan : coût estimé depuis le prix de vente.</li>}
            <li>Remises, coupons et retours sont répartis sur les articles de la commande.</li>
          </ul>
        </Card>
      </div>
      <Table title="Par canal" head="Canal" rows={r.channels} showQty={false} />
      <Table title="Par gamme" head="Gamme" rows={r.categories} />
      <Table title="Par produit et format" head="Produit" rows={r.products} limit={60} />
      <Table title="Par revendeur" head="Revendeur" rows={r.sellers} limit={40} />
    </div>
  );
}
