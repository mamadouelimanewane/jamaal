import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const clients = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: { orders: { select: { total: true, status: true } } },
    take: 300,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Clients ({clients.length})
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/clients/inactifs"
            className="rounded-full border border-rose/30 bg-rose-light/20 px-4 py-2 text-sm font-semibold text-rose-dark hover:bg-rose-light/40"
          >
            📢 Relance CRM Clients
          </Link>
          <a
            href="/api/export/clients"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            Exporter Excel ↓
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Fiches créées automatiquement à chaque commande, pour suivre l&apos;historique de vos clients.
      </p>

      <form className="mt-4" action="/admin/clients">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou téléphone…"
          className="w-full max-w-sm rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-navy"
        />
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Commandes</th>
              <th className="px-4 py-3">Total dépensé</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const total = c.orders
                .filter((o) => o.status !== "ANNULEE")
                .reduce((sum, o) => sum + o.total, 0);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                  <td className="px-4 py-3 text-navy/85">{c.phone}</td>
                  <td className="px-4 py-3 text-navy/85">{c.orders.length}</td>
                  <td className="px-4 py-3 text-navy/85">{formatPrice(total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/clients/${c.id}`} className="text-xs font-semibold text-navy hover:underline">
                      Voir la fiche
                    </Link>
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/70">
                  Aucun client pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
