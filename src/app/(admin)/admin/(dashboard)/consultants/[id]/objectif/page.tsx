import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { setMonthlyTarget } from "@/lib/actions/targets";
import { getConsultantCommission } from "@/lib/commission";
import { ArrowLeft, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConsultantObjectifPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [consultant, commission] = await Promise.all([
    prisma.consultant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        targets: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 },
      },
    }),
    getConsultantCommission(id),
  ]);
  if (!consultant) notFound();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentTarget = consultant.targets.find(
    (t) => t.year === currentYear && t.month === currentMonth
  );

  const targetProgress = currentTarget
    ? Math.min(100, Math.round((commission.monthlyRevenue / currentTarget.targetRevenue) * 100))
    : null;

  const MONTHS_FR = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
  ];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/consultants/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Objectif mensuel — {consultant.name}
          </h1>
          <p className="text-sm text-navy/60">
            CA ce mois :{" "}
            <span className="font-semibold text-navy">
              {formatPrice(commission.monthlyRevenue)}
            </span>
          </p>
        </div>
      </div>

      {/* Progression actuelle */}
      {currentTarget && (
        <div className="mt-5 rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">
            Objectif {MONTHS_FR[currentMonth - 1]} {currentYear}
          </p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-bold text-navy">
              {formatPrice(commission.monthlyRevenue)}
            </span>
            <span className="text-navy/50">sur {formatPrice(currentTarget.targetRevenue)}</span>
          </div>
          <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-cream">
            <div
              className={`h-4 rounded-full transition-all ${
                targetProgress! >= 100
                  ? "bg-emerald-500"
                  : targetProgress! >= 60
                  ? "bg-amber-400"
                  : "bg-rose-dark"
              }`}
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <p
            className={`mt-1 text-right text-sm font-bold ${
              targetProgress! >= 100 ? "text-emerald-600" : "text-navy/70"
            }`}
          >
            {targetProgress! >= 100
              ? "🎉 Objectif atteint !"
              : `${targetProgress}% atteint`}
          </p>
        </div>
      )}

      {/* Formulaire */}
      <form
        action={setMonthlyTarget.bind(null, id)}
        className="mt-5 rounded-2xl border border-line bg-white p-5"
      >
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-navy">
          <Target size={18} className="text-blue-500" />
          Définir / Modifier un objectif
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-navy/70">Année</label>
            <input
              name="year"
              type="number"
              defaultValue={currentYear}
              required
              className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy/70">Mois (1-12)</label>
            <input
              name="month"
              type="number"
              min="1"
              max="12"
              defaultValue={currentMonth}
              required
              className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-navy/70">
              Objectif de CA (FCFA) *
            </label>
            <input
              name="targetRevenue"
              type="number"
              min="0"
              step="5000"
              defaultValue={currentTarget?.targetRevenue ?? ""}
              required
              placeholder="Ex: 150 000"
              className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-xl bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
        >
          Enregistrer l&apos;objectif
        </button>
      </form>

      {/* Historique */}
      <div className="mt-5 rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-4 font-semibold text-navy">
          Historique des Objectifs
        </h2>
        {consultant.targets.length === 0 ? (
          <p className="px-5 py-6 text-xs text-navy/40">Aucun objectif défini.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="px-4 py-3">Mois</th>
                <th className="px-4 py-3">Objectif de CA</th>
              </tr>
            </thead>
            <tbody>
              {consultant.targets.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-navy">
                    {MONTHS_FR[t.month - 1]} {t.year}
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-700">
                    {formatPrice(t.targetRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
