import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { StatCard } from "@/components/admin/StatCard";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

const expenseCategories = ["Achat stock", "Livraison", "Marketing", "Salaires", "Loyer", "Autre"];

export default async function AdminComptabilitePage() {
  const [revenueAgg, expenses] = await Promise.all([
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "ANNULEE" } } }),
    prisma.expense.findMany({ orderBy: { date: "desc" }, take: 100 }),
  ]);

  const revenue = revenueAgg._sum.total ?? 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue - totalExpenses;

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Comptabilité</h1>
      <p className="mt-1 text-sm text-navy/60">Suivi des revenus, des dépenses et de la marge.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Chiffre d'affaires" value={formatPrice(revenue)} icon={TrendingUp} color="emerald" />
        <StatCard label="Dépenses" value={formatPrice(totalExpenses)} icon={TrendingDown} color="red" />
        <StatCard label="Marge nette" value={formatPrice(profit)} icon={Wallet} color={profit >= 0 ? "navy" : "red"} />
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
          <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">Dernières dépenses</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
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
