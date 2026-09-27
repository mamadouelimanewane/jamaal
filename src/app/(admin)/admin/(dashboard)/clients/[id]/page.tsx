import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { updateCustomerNotes } from "@/lib/actions/customers";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" } } },
  });
  if (!client) notFound();

  const total = client.orders
    .filter((o) => o.status !== "ANNULEE")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="max-w-2xl">
      <p className="mb-2 text-xs text-navy/50">
        <Link href="/admin/clients">Clients</Link> / {client.name}
      </p>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">{client.name}</h1>
      <p className="mt-1 text-sm text-navy/60">
        {client.phone} {client.email ? `— ${client.email}` : ""}
      </p>
      {client.address && <p className="text-sm text-navy/60">{client.address}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-semibold text-navy">{client.orders.length}</p>
          <p className="text-xs text-navy/60">Commandes passées</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-semibold text-navy">{formatPrice(total)}</p>
          <p className="text-xs text-navy/60">Total dépensé</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Notes internes</h2>
        <form action={updateCustomerNotes.bind(null, client.id)} className="flex flex-col gap-3">
          <textarea
            name="notes"
            rows={3}
            defaultValue={client.notes ?? ""}
            placeholder="Préférences, historique de contact, remarques…"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <button className="w-fit rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            Enregistrer
          </button>
        </form>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">Historique des commandes</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {client.orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-4 py-3 text-navy/70">{o.createdAt.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-navy/70">{statusLabels[o.status] ?? o.status}</td>
                  <td className="px-4 py-3 text-navy/70">{formatPrice(o.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/commandes/${o.id}`} className="text-xs font-semibold text-navy hover:underline">
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
