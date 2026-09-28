import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getConsultantCommission } from "@/lib/commission";
import { recordCommissionPayment, deleteCommissionPayment } from "@/lib/actions/commission-payments";
import { ArrowLeft, Wallet, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommissionPaymentPage({
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
        commissionPayments: { orderBy: { paidAt: "desc" } },
      },
    }),
    getConsultantCommission(id),
  ]);
  if (!consultant) notFound();

  const totalPaid = consultant.commissionPayments.reduce(
    (s, p) => s + p.amount,
    0
  );
  const totalGross =
    commission.lifetimeCommission +
    commission.lifetimeSponsorCommission +
    commission.lifetimeL2Commission;
  const netDue = Math.max(0, totalGross - totalPaid);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/consultants/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Commissions — {consultant.name}
          </h1>
          <p className="text-sm text-navy/60">
            Solde net restant dû :{" "}
            <span className="font-bold text-rose-dark">{formatPrice(netDue)}</span>
          </p>
        </div>
      </div>

      {/* Résumé commissions */}
      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-4">
        {[
          { label: "Ventes directes", value: commission.lifetimeCommission, color: "text-emerald-700" },
          { label: "Filleuls N1", value: commission.lifetimeSponsorCommission, color: "text-blue-600" },
          { label: "Filleuls N2", value: commission.lifetimeL2Commission, color: "text-purple-600" },
          { label: "Total Brut Dû", value: totalGross, color: "text-navy font-bold" },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">
              {item.label}
            </p>
            <p className={`mt-1 text-lg font-bold ${item.color}`}>
              {formatPrice(item.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">
            Total Payé
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{formatPrice(totalPaid)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">
            Net Restant Dû
          </p>
          <p className={`mt-1 text-lg font-bold ${netDue > 0 ? "text-rose-dark" : "text-emerald-600"}`}>
            {netDue > 0 ? formatPrice(netDue) : "✓ Soldé"}
          </p>
        </div>
      </div>

      {/* Formulaire de paiement */}
      <form
        action={recordCommissionPayment.bind(null, id)}
        className="mt-6 rounded-2xl border border-line bg-white p-5"
      >
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-navy">
          <Wallet size={18} className="text-emerald-600" />
          Enregistrer un nouveau versement
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-navy/70">
              Période concernée *
            </label>
            <input
              name="periodLabel"
              required
              placeholder="Ex: Octobre 2026"
              className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy/70">
              Montant versé (FCFA) *
            </label>
            <input
              name="amount"
              type="number"
              min="1"
              step="500"
              required
              placeholder="Ex: 15000"
              className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy/70">
              Note / moyen de paiement
            </label>
            <input
              name="note"
              placeholder="Ex: Virement Wave"
              className="mt-1 w-full rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-sm text-navy focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-xl bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
        >
          Enregistrer le versement
        </button>
      </form>

      {/* Historique des versements */}
      <div className="mt-6 rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy">
            Historique des Versements ({consultant.commissionPayments.length})
          </h2>
          <span className="text-xs text-navy/50">
            Total payé : {formatPrice(totalPaid)}
          </span>
        </div>
        {consultant.commissionPayments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-navy/40">
            <TrendingUp className="mx-auto mb-2 text-navy/20" size={28} />
            Aucun versement enregistré pour ce revendeur.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Date du versement</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {consultant.commissionPayments.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-navy">{p.periodLabel}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">
                      {formatPrice(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-navy/60">{p.note ?? "—"}</td>
                    <td className="px-4 py-3 text-navy/60">
                      {p.paidAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={deleteCommissionPayment.bind(null, p.id, id)}
                        className="inline"
                      >
                        <button className="text-xs font-semibold text-rose-dark hover:underline">
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
