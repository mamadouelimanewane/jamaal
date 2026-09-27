import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Commandes ({orders.length})
      </h1>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/admin/commandes/${o.id}`} className="font-medium text-navy hover:underline">
                    {o.customerName}
                  </Link>
                  <p className="text-xs text-navy/50">{o.customerPhone ?? o.customerEmail ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-navy/70">{o.items.length}</td>
                <td className="px-4 py-3 text-navy/70">{formatPrice(o.total)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-navy">
                    {statusLabels[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-navy/60">{o.createdAt.toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/50">
                  Aucune commande pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
