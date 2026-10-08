import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { createReturn, deleteReturn } from "@/lib/actions/returns";
import { ReturnStatusSelect } from "@/components/admin/ReturnStatusSelect";

export const dynamic = "force-dynamic";

export default async function AdminReturnsPage() {
  const [returns, orders] = await Promise.all([
    prisma.return.findMany({ orderBy: { createdAt: "desc" }, include: { order: true } }),
    prisma.order.findMany({
      where: { status: { not: "ANNULEE" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, customerName: true, total: true, createdAt: true },
    }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Retours & remboursements ({returns.length})
        </h1>
        <a
          href="/api/export/retours"
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          Exporter Excel ↓
        </a>
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Un remboursement validé est automatiquement déduit du chiffre d&apos;affaires et du classement des consultants.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-navy">Déclarer un retour</h2>
          <form action={createReturn} className="grid gap-3 rounded-2xl border border-line bg-white p-5">
            <select name="orderId" required className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy">
              <option value="">Sélectionner une commande…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.customerName} — {formatPrice(o.total)} — {o.createdAt.toLocaleDateString("fr-FR")}
                </option>
              ))}
            </select>
            <input
              name="reason"
              required
              placeholder="Motif du retour"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <input
              type="number"
              name="amount"
              required
              placeholder="Montant à rembourser (FCFA)"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <button className="w-fit rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
              Déclarer
            </button>
          </form>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-navy">Historique</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/70">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Motif</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-3 text-navy">{r.order.customerName}</td>
                    <td className="px-4 py-3 text-navy/85">{r.reason}</td>
                    <td className="px-4 py-3 text-navy/85">{formatPrice(r.amount)}</td>
                    <td className="px-4 py-3">
                      <ReturnStatusSelect id={r.id} status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteReturn.bind(null, r.id)} className="inline">
                        <button className="text-xs font-semibold text-rose-dark hover:underline">
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {returns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-navy/70">
                      Aucun retour déclaré.
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
