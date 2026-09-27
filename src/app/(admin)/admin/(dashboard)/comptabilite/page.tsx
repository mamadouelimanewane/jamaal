import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { updateCommissionRate } from "@/lib/actions/settings";
import { getCommissionRate } from "@/lib/settings";
import { getRefundedTotal } from "@/lib/revenue";
import { StatCard } from "@/components/admin/StatCard";
import { TrendingUp, TrendingDown, Wallet, Percent, Undo2, FileSpreadsheet } from "lucide-react";

export const dynamic = "force-dynamic";

const expenseCategories = ["Achat stock", "Livraison", "Marketing", "Salaires", "Loyer", "Autre"];

export default async function AdminComptabilitePage() {
  const [revenueAgg, expenses, totalRefunded, commissionableAgg, commissionableRefunded, rate] =
    await Promise.all([
      prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "ANNULEE" } } }),
      prisma.expense.findMany({ orderBy: { date: "desc" }, take: 100 }),
      getRefundedTotal(),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: "ANNULEE" }, consultantId: { not: null } },
      }),
      prisma.return.aggregate({
        _sum: { amount: true },
        where: { status: "REMBOURSE", order: { consultantId: { not: null } } },
      }),
      getCommissionRate(),
    ]);

  const grossRevenue = revenueAgg._sum.total ?? 0;
  const revenue = Math.max(0, grossRevenue - totalRefunded);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const commissionableRevenue = Math.max(
    0,
    (commissionableAgg._sum.total ?? 0) - (commissionableRefunded._sum.amount ?? 0)
  );
  const commissionsDue = Math.round((commissionableRevenue * rate) / 100);
  const profit = revenue - totalExpenses - commissionsDue;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Comptabilité</h1>
        <a
          href="/api/export/tout"
          className="flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          <FileSpreadsheet size={16} />
          Export complet (Excel)
        </a>
      </div>
      <p className="mt-1 text-sm text-navy/60">
        Suivi des revenus (nets des remboursements), des dépenses, des commissions et de la marge.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Chiffre d'affaires net" value={formatPrice(revenue)} icon={TrendingUp} color="emerald" />
        <StatCard label="Dépenses" value={formatPrice(totalExpenses)} icon={TrendingDown} color="red" />
        <StatCard label="Remboursements" value={formatPrice(totalRefunded)} icon={Undo2} color="amber" href="/admin/retours" />
        <StatCard label="Commissions dues aux revendeurs" value={formatPrice(commissionsDue)} icon={Percent} color="purple" href="/admin/consultants" />
        <StatCard label="Marge nette" value={formatPrice(profit)} icon={Wallet} color={profit >= 0 ? "navy" : "red"} />
      </div>

      <div className="mt-8 max-w-sm">
        <h2 className="mb-3 text-sm font-semibold text-navy">Taux de commission des revendeurs</h2>
        <form action={updateCommissionRate} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <input
            type="number"
            name="rate"
            min={0}
            max={100}
            step="0.1"
            defaultValue={rate}
            className="w-24 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <span className="text-sm text-navy/60">% du CA généré par chaque revendeur</span>
          <button className="w-full rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-light sm:ml-auto sm:w-fit">
            Enregistrer
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">Ajouter une dépense</h2>
          <form action={createExpense} className="grid gap-3 rounded-2xl border border-line bg-white p-5">
            <input
              name="label"
              required
              placeholder="Libellé (ex: Achat carton d'huiles)"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <input
              type="number"
              name="amount"
              required
              placeholder="Montant (FCFA)"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <select name="category" className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy">
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <button className="w-fit rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
              Ajouter
            </button>
          </form>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif-display text-lg font-semibold text-navy">Dernières dépenses</h2>
            <a
              href="/api/export/depenses"
              className="text-xs font-semibold text-navy hover:underline"
            >
              Exporter Excel ↓
            </a>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="px-4 py-3 text-navy">{e.label}</td>
                    <td className="px-4 py-3 text-navy/60">{e.category}</td>
                    <td className="px-4 py-3 text-navy/70">{formatPrice(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteExpense.bind(null, e.id)} className="inline">
                        <button className="text-xs font-semibold text-rose-dark hover:underline">
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-navy/50">
                      Aucune dépense enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
