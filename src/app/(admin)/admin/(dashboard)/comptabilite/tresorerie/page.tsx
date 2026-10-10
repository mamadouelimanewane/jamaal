import Link from "next/link";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { CHANNELS, labelFor } from "@/lib/accounting/chart";
import { dateFr, fcfa, isoDay } from "@/lib/accounting/format";
import { cashBalances, cashFlowByMonth, isCash, monthKeyOf, monthLabel, monthsBetween } from "@/lib/accounting/reports";
import { cashForecast, refundsOwed } from "@/lib/accounting/insights";
import { markOrderRefundedAction, saveCashCountAction } from "@/lib/actions/accounting";
import { prisma } from "@/lib/prisma";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btn, Card, field, td, tdr, th, thr } from "@/components/accounting/ui";
import type { SourceType } from "@/lib/accounting/posting";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<SourceType, string> = {
  COMMANDE: "Ventes et acomptes clients",
  RETOUR: "Retours remboursés",
  WALLET: "Wallets (dépôts, retraits)",
  COMMISSION: "Commissions",
  LIVREUR: "Livreurs (avant wallet)",
  VERSEMENT: "Versements de commissions (avant wallet)",
  DEPENSE: "Dépenses et factures",
  MANUELLE: "Écritures manuelles",
  STOCK: "Stocks",
};

export default async function TresoreriePage({ searchParams }: { searchParams: SP }) {
  const { L, period, query } = await accountingContext(searchParams);
  const now = new Date();
  const at = period.to > now ? new Date(now.getTime() + 1000) : period.to;
  const start = cashBalances(L.entries, period.from);
  const end = cashBalances(L.entries, at);
  const startOf = new Map(start.map((c) => [c.account, c.balance]));
  const total = end.reduce((s, c) => s + c.balance, 0);
  const months = monthsBetween(monthKeyOf(period.from), monthKeyOf(new Date(period.to.getTime() - 1))).slice(-24);
  const flows = cashFlowByMonth(L.entries, months);

  // D'où vient l'argent, où il va (hors virements internes)
  const bySource = new Map<string, { inflow: number; outflow: number }>();
  for (const e of L.entries) {
    if (e.date < period.from || e.date >= period.to) continue;
    if (e.lines.every((l) => isCash(l.account) || l.account.startsWith("585"))) continue;
    const net = e.lines.filter((l) => isCash(l.account)).reduce((s, l) => s + l.debit - l.credit, 0);
    if (!net) continue;
    const k = SOURCE_LABELS[e.source.type];
    const r = bySource.get(k) ?? { inflow: 0, outflow: 0 };
    if (net > 0) r.inflow += net;
    else r.outflow -= net;
    bySource.set(k, r);
  }

  const [forecast, refunds, counts] = await Promise.all([cashForecast(), refundsOwed(), prisma.cashCount.findMany({ orderBy: { createdAt: "desc" }, take: 15 })]);
  const today = isoDay(now);

  return (
    <div className="space-y-6">
      <h2 className="font-serif-display text-xl font-semibold text-navy">Trésorerie</h2>
      <PeriodPicker path="/admin/comptabilite/tresorerie" period={period} />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {end.map((c) => {
          const delta = c.balance - (startOf.get(c.account) ?? 0);
          return (
            <Link key={c.account} href={`/admin/comptabilite/grand-livre?compte=${c.account}&${query}`} className="rounded-2xl border border-line bg-white p-4 hover:shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-navy/70">{labelFor(c.account, L.accounts)}</p>
              <p className={`mt-1 text-xl font-semibold ${c.balance < 0 ? "text-red-700" : "text-navy"}`}>{fcfa(c.balance)}</p>
              <p className={`text-xs ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>{delta >= 0 ? "+" : ""}{fcfa(delta)} sur la période</p>
            </Link>
          );
        })}
        <div className="rounded-2xl border border-navy bg-navy p-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-white/75">Total disponible</p>
          <p className="mt-1 text-xl font-semibold">{fcfa(total)}</p>
          <p className="text-xs text-white/75">au {dateFr(new Date(at.getTime() - 1))}</p>
        </div>
      </div>
      <p className="text-xs text-navy/65">Un solde négatif signale un encaissement non saisi (ex. un apport) ou une sortie passée sur le mauvais compte : vérifiez avec un comptage ci-dessous.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Prévisionnel">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2"><span>Paiements à la livraison attendus ({forecast.codCount})</span><strong className="text-emerald-700">+{fcfa(forecast.codExpected)}</strong></li>
            <li className="flex justify-between gap-2"><span>Soldes de réservations ({forecast.reservationsCount})</span><strong className="text-emerald-700">+{fcfa(forecast.reservationsExpected)}</strong></li>
            <li className="flex justify-between gap-2"><span>Retraits wallet à verser ({forecast.pendingWithdrawalsCount})</span><strong className="text-red-700">−{fcfa(forecast.pendingWithdrawals)}</strong></li>
            <li className="flex justify-between gap-2"><span>Factures fournisseurs à payer ({forecast.unpaidBillsCount})</span><strong className="text-red-700">−{fcfa(forecast.unpaidBills)}</strong></li>
            <li className="flex justify-between gap-2"><span>Clients à rembourser ({forecast.refundsCount})</span><strong className="text-red-700">−{fcfa(forecast.refundsOwed)}</strong></li>
            <li className="flex justify-between gap-2 border-t border-line pt-2 font-semibold">
              <span>Trésorerie prévisible</span>
              <span>{fcfa(total + forecast.codExpected + forecast.reservationsExpected - forecast.pendingWithdrawals - forecast.unpaidBills - forecast.refundsOwed)}</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-navy/65">Les soldes des wallets restent retirables à tout moment : gardez de quoi les couvrir (voir le bilan).</p>
        </Card>
        <Card title="D'où vient l'argent, où il va">
          <table className="keep-table w-full text-sm">
            <thead><tr><th className={th}>Origine</th><th className={thr}>Entrées</th><th className={thr}>Sorties</th></tr></thead>
            <tbody>
              {[...bySource].map(([k, v]) => (
                <tr key={k} className="border-t border-line">
                  <td className={td}>{k}</td>
                  <td className={`${tdr} text-emerald-700`}><Amount value={v.inflow} blankZero /></td>
                  <td className={`${tdr} text-red-700`}><Amount value={v.outflow} blankZero /></td>
                </tr>
              ))}
              {!bySource.size && <tr><td colSpan={3} className="py-4 text-center text-navy/70">Aucun mouvement sur la période.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {flows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream"><tr><th className={th}>Mois</th><th className={thr}>Entrées</th><th className={thr}>Sorties</th><th className={thr}>Flux net</th><th className={thr}>Trésorerie fin de mois</th></tr></thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.month} className="border-t border-line">
                  <td className={`${td} capitalize`}>{monthLabel(f.month)}</td>
                  <td className={tdr}><Amount value={f.inflow} /></td>
                  <td className={tdr}><Amount value={-f.outflow} /></td>
                  <td className={tdr}><Amount value={f.net} strong /></td>
                  <td className={tdr}><Amount value={f.closing} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card title={<span id="rembourser">Clients à rembourser</span>}>
        {refunds.length ? (
          <ul className="space-y-3">
            {refunds.map((o) => (
              <li key={o.id} className="rounded-xl border border-line p-3">
                <p className="text-sm text-navy">
                  <Link href={`/admin/commandes/${o.id}`} className="font-semibold hover:underline">#{o.id.slice(-8).toUpperCase()} · {o.customerName}</Link>
                  {o.customerPhone && <> · {o.customerPhone}</>} — <strong>{fcfa(o.owed)}</strong> {o.isReservation ? "(acompte de réservation)" : "(commande payée puis annulée)"}
                </p>
                <form action={markOrderRefundedAction} className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_1fr_auto]">
                  <input type="hidden" name="orderId" value={o.id} />
                  <select name="channel" className={field} aria-label="Remboursé par" defaultValue={o.paymentMethod === "ORANGE_MONEY" ? "ORANGE_MONEY" : o.paymentMethod === "WAVE" ? "WAVE" : "CAISSE"}>
                    {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>Remboursé par {v.label}</option>)}
                    {o.isReservation && <option value="CONSERVE">Acompte conservé (non remboursable)</option>}
                  </select>
                  <input type="date" name="date" defaultValue={today} className={field} aria-label="Date" />
                  <input name="note" placeholder="Note (référence du transfert…)" className={field} />
                  <button className={btn}>Enregistrer</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-navy/70">Aucun client à rembourser.</p>
        )}
      </Card>

      <Card title={<span id="comptage">Comptage de caisse et rapprochement</span>}>
        <p className="mb-3 text-sm text-navy/75">Comptez les espèces, ou relevez le solde affiché par Wave, Orange Money ou la banque : l&apos;écart avec la comptabilité s&apos;affiche, et vous pouvez le constater (perte ou excédent).</p>
        <form action={saveCashCountAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_150px_150px_1fr]">
          <select name="account" className={field} aria-label="Compte">
            {end.map((c) => <option key={c.account} value={c.account}>{labelFor(c.account, L.accounts)} (comptabilité : {fcfa(c.balance)})</option>)}
          </select>
          <input type="date" name="date" defaultValue={today} className={field} aria-label="Date du comptage" />
          <input name="counted" required inputMode="numeric" placeholder="Solde réel (F)" className={field} />
          <input name="note" placeholder="Note (facultatif)" className={field} />
          <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2 lg:col-span-3"><input type="checkbox" name="adjust" /> Constater l&apos;écart en comptabilité (charge ou produit divers)</label>
          <button className={btn}>Enregistrer le comptage</button>
        </form>
        {counts.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead><tr><th className={th}>Compte</th><th className={th}>Date</th><th className={thr}>Réel</th><th className={thr}>Comptabilité</th><th className={thr}>Écart</th></tr></thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className={td}>{labelFor(c.account, L.accounts)}{c.note && <span className="block text-xs text-navy/65">{c.note}</span>}</td>
                  <td className={td}>{dateFr(c.date)}</td>
                  <td className={tdr}><Amount value={c.counted} /></td>
                  <td className={tdr}><Amount value={c.theoretical} /></td>
                  <td className={tdr}><Amount value={c.counted - c.theoretical} strong /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
