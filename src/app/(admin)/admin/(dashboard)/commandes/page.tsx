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

const statusColors: Record<string, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-700",
  CONFIRMEE: "bg-blue-100 text-blue-700",
  EXPEDIEE: "bg-purple-100 text-purple-700",
  LIVREE: "bg-emerald-100 text-emerald-700",
  ANNULEE: "bg-red-100 text-red-700",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true, consultant: true, livreur: true },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Commandes ({orders.length})
        </h1>
        <a
          href="/api/export/commandes"
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          Exporter Excel ↓
        </a>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Revendeur</th>
              <th className="px-4 py-3">Livraison</th>
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
                  <p className="text-xs text-navy/70">{o.customerPhone ?? o.customerEmail ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-navy/85">{o.items.length}</td>
                <td className="px-4 py-3 text-navy/85">{formatPrice(o.total)}</td>
                <td className="px-4 py-3 text-navy/85">{o.consultant?.name ?? "—"}</td>
                <td className="px-4 py-3 text-navy/85">
                  {o.deliveryMode === "LIVRAISON_JAMAAL" ? (
                    <span>JAMAAL{o.livreur ? ` · ${o.livreur.name}` : ""}</span>
                  ) : (
                    "Retrait consultant"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[o.status] ?? "bg-cream text-navy"}`}>
                    {statusLabels[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-navy/75">{o.createdAt.toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-navy/70">
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
