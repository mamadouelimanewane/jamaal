import Link from "next/link";
import { AlertTriangle, FilePlus2, NotebookPen, Calculator, FileSpreadsheet } from "lucide-react";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { cashBalances, incomeStatement, journalCheck, monthKeyOf, monthStart, monthsBetween, nextMonth, solde, totalsBy, vatByMonth } from "@/lib/accounting/reports";
import { labelFor } from "@/lib/accounting/chart";
import { fcfa, pct } from "@/lib/accounting/format";
import { cashForecast } from "@/lib/accounting/insights";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { MonthlyChart } from "@/components/accounting/MonthlyChart";
import { Amount, btn, btnLight, Card, Kpi } from "@/components/accounting/ui";
import { BarList } from "@/components/admin/BarList";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Charges de la période, hors variation de stock (correction du coût des marchandises). */
const charge6 = (t: Map<string, { debit: number; credit: number }>) => [...t].filter(([c]) => (c.startsWith("6") || c.startsWith("8")) && c !== "6031").reduce((s, [, v]) => s + v.debit - v.credit, 0);

export default async function ComptabiliteDashboard({ searchParams }: { searchParams: SP }) {
  const { L, period, query } = await accountingContext(searchParams);
  const { entries, accounts, settings } = L;
  const inP = totalsBy(entries, (e) => e.date >= period.from && e.date < period.to);
  const is = incomeStatement(inP);
  const charges = charge6(inP);
  const now = new Date();
  const at = period.to < now ? period.to : new Date(now.getTime() + 1000);
  const upTo = totalsBy(entries, (e) => e.date < at);
  const cash = cashBalances(entries, at);
  const totalCash = cash.reduce((s, c) => s + c.balance, 0);
  const wallets = -(solde(upTo.get("4671")) + solde(upTo.get("4672")));
  const clientsAdvance = Math.max(0, -solde(upTo.get("411")));
  const stock = solde(upTo.get("311"));
  const suppliers = Math.max(0, -solde(upTo.get("401")));

  // 12 derniers mois jusqu'à la fin de la période
  const endKey = monthKeyOf(new Date(period.to.getTime() - 1));
  const end = monthStart(endKey);
  const startKey = monthKeyOf(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1)));
  const series = monthsBetween(startKey, endKey).map((m) => {
    const t = totalsBy(entries, (e) => e.date >= monthStart(m) && e.date < monthStart(nextMonth(m)));
    const s = incomeStatement(t);
    return { month: m, revenue: s.chiffreAffaires, charges: charge6(t), result: s.resultatNet };
  });

  const topCharges = [...inP]
    .filter(([c]) => c.startsWith("6") && c !== "6031")
    .map(([c, t]) => ({ label: `${c} · ${labelFor(c, accounts)}`, value: t.debit - t.credit }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Contrôles et alertes
  const check = journalCheck(entries);
  const forecast = await cashForecast();
  const lastMonth = monthKeyOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const startMonth = monthKeyOf(L.start);
  const notClosed = monthsBetween(startMonth, lastMonth).filter((m) => !L.closedMonths.has(m));
  const overdue = await prisma.expense.count({ where: { paid: false, dueDate: { lt: now } } });
  const vatPending = settings.vatEnabled
    ? vatByMonth(entries, monthsBetween(startMonth, lastMonth), new Set()).filter((r) => (r.collected || r.deductible) && !entries.some((e) => e.ref === `TVA-${r.month}`)).length
    : 0;
  const alerts: { text: string; href: string }[] = [];
  if (check.unbalanced.length) alerts.push({ text: `${check.unbalanced.length} écriture(s) déséquilibrée(s) : à corriger.`, href: "/admin/comptabilite/journal" });
  if (forecast.refundsCount) alerts.push({ text: `${forecast.refundsCount} client(s) à rembourser (commandes annulées déjà payées) : ${fcfa(forecast.refundsOwed)}.`, href: "/admin/comptabilite/tresorerie#rembourser" });
  if (overdue) alerts.push({ text: `${overdue} facture(s) fournisseur en retard de paiement.`, href: "/admin/comptabilite/depenses?statut=a-payer" });
  if (forecast.pendingWithdrawalsCount) alerts.push({ text: `${forecast.pendingWithdrawalsCount} retrait(s) wallet à verser : ${fcfa(forecast.pendingWithdrawals)}.`, href: "/admin/wallets" });
  if (vatPending) alerts.push({ text: `${vatPending} mois de TVA à déclarer.`, href: "/admin/comptabilite/tva" });
  if (L.stock.estimated) alerts.push({ text: `${L.stock.estimated} format(s) sans prix public Chogan : valeur d'achat estimée depuis le prix de vente.`, href: "/admin/stocks" });
  if (settings.purchaseMode === "DEPENSES") {
    const received = L.receptions.filter((r) => r.date >= period.from && r.date < period.to).reduce((s, r) => s + r.value, 0);
    const bought = is.achats;
    if (received > 0 && bought < received * 0.8) alerts.push({ text: `Stock reçu sur la période : ${fcfa(received)} (prix d'achat), mais seulement ${fcfa(bought)} d'achats de marchandises saisis. Enregistrez les factures Chogan (dépense 601), sinon la marge est surestimée.`, href: "/admin/comptabilite/depenses?nouvelle=1#saisie" });
  }
  if (notClosed.length) alerts.push({ text: `${notClosed.length} mois terminé(s) pas encore clôturé(s) (${notClosed.slice(-3).join(", ")}).`, href: "/admin/comptabilite/clotures" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href="/admin/comptabilite/depenses?nouvelle=1#saisie" className={`${btn} inline-flex items-center gap-2`}><FilePlus2 size={16} /> Nouvelle dépense</Link>
        <Link href="/admin/comptabilite/journal/saisie" className={`${btnLight} inline-flex items-center gap-2`}><NotebookPen size={16} /> Écriture manuelle</Link>
        <Link href="/admin/comptabilite/tresorerie#comptage" className={`${btnLight} inline-flex items-center gap-2`}><Calculator size={16} /> Comptage de caisse</Link>
        <a href={`/api/export/comptabilite?type=liasse&${query}`} className={`${btnLight} inline-flex items-center gap-2`}><FileSpreadsheet size={16} /> Dossier complet (Excel)</a>
      </div>

      <PeriodPicker path="/admin/comptabilite" period={period} />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Chiffre d'affaires" value={is.chiffreAffaires} hint={`Ventes ${fcfa(is.ventes)} · livraison ${fcfa(is.servicesVendus)}`} href={`/admin/comptabilite/resultat?${query}`} />
        <Kpi label="Marge commerciale" value={is.margeCommerciale} hint={`${pct(is.margeCommerciale, is.ventes)} des ventes`} tone={is.margeCommerciale >= 0 ? "green" : "red"} href={`/admin/comptabilite/marges?${query}`} />
        <Kpi label="Charges" value={charges} hint={`dont commissions ${fcfa(is.commissionsReseau)} · variation de stock ${is.variation <= 0 ? "+" : "−"}${fcfa(Math.abs(is.variation))}`} tone="amber" href={`/admin/comptabilite/depenses?${query}`} />
        <Kpi label="Résultat net" value={is.resultatNet} hint={`EBE ${fcfa(is.ebe)}`} tone={is.resultatNet >= 0 ? "green" : "red"} href={`/admin/comptabilite/resultat?${query}`} />
        <Kpi label="Trésorerie disponible" value={totalCash} hint="Wave, Orange Money, caisse, banque" href={`/admin/comptabilite/tresorerie?${query}`} />
        <Kpi label="Dû au réseau (wallets)" value={wallets} hint="Revendeurs et livreurs" tone="amber" href="/admin/wallets" />
        <Kpi label="Stock (valeur d'achat)" value={stock} hint={`Aujourd'hui : ${fcfa(L.stock.current)}`} href="/admin/stocks" />
        <Kpi label="Avances clients" value={clientsAdvance} hint={suppliers ? `Fournisseurs à payer : ${fcfa(suppliers)}` : "Acomptes et commandes payées d'avance"} href={`/admin/comptabilite/bilan?${query}`} />
      </div>

      {alerts.length > 0 && (
        <Card title="À traiter">
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 hover:bg-amber-100">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {a.text}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Évolution sur 12 mois">
        <MonthlyChart data={series} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Trésorerie par compte" action={<Link href={`/admin/comptabilite/tresorerie?${query}`} className="text-xs font-semibold text-navy hover:underline">Détail →</Link>}>
          <table className="keep-table w-full text-sm">
            <tbody>
              {cash.map((c) => (
                <tr key={c.account} className="border-t border-line first:border-0">
                  <td className="py-2 pr-2 text-navy">{labelFor(c.account, accounts)}</td>
                  <td className="py-2 text-right"><Amount value={c.balance} /> F</td>
                </tr>
              ))}
              <tr className="border-t-2 border-navy/20 font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right"><Amount value={totalCash} strong /> F</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <p className="rounded-xl bg-emerald-50 p-2.5 text-emerald-900">À encaisser : <strong>{fcfa(forecast.codExpected + forecast.reservationsExpected)}</strong><br />{forecast.codCount} commande(s) à la livraison, {forecast.reservationsCount} solde(s) de réservation</p>
            <p className="rounded-xl bg-red-50 p-2.5 text-red-900">À décaisser : <strong>{fcfa(forecast.pendingWithdrawals + forecast.unpaidBills + forecast.refundsOwed)}</strong><br />retraits wallet, factures, remboursements</p>
          </div>
        </Card>
        <Card title="Principales charges de la période">
          <BarList items={topCharges} formatValue={fcfa} color="rose" />
        </Card>
      </div>

      <p className="text-xs text-navy/70">
        Comptabilité tenue depuis le {L.start.toLocaleDateString("fr-FR", { timeZone: "UTC" })} · {entries.length.toLocaleString("fr-FR")} écritures · total débit {check.debit === check.credit ? "=" : "≠"} total crédit ({fcfa(check.debit)}) {check.debit === check.credit ? "✓" : "✗"}
      </p>
    </div>
  );
}
