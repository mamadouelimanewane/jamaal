import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { deleteConsultant } from "@/lib/actions/consultants";

export const dynamic = "force-dynamic";

export default async function AdminConsultantsPage() {
  const consultants = await prisma.consultant.findMany({
    orderBy: { name: "asc" },
    include: {
      user: true,
      orders: { select: { total: true, status: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Revendeurs / Consultants ({consultants.length})
        </h1>
        <Link
          href="/admin/consultants/nouveau"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + Nouveau
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Ventes</th>
              <th className="px-4 py-3">Compte portail</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {consultants.map((c) => {
              const revenue = c.orders
                .filter((o) => o.status !== "ANNULEE")
                .reduce((sum, o) => sum + o.total, 0);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-navy">
                    <a
                      href={c.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {c.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{c.city}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {c.orders.length} commande(s) — {formatPrice(revenue)}
                  </td>
                  <td className="px-4 py-3">
                    {c.user ? (
                      <span className="text-xs font-semibold text-green-700">{c.user.email}</span>
                    ) : (
                      <span className="text-xs text-navy/40">Non créé</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <span className="text-xs font-semibold text-green-700">Actif</span>
                    ) : (
                      <span className="text-xs font-semibold text-navy/40">Inactif</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/consultants/${c.id}/modifier`}
                      className="mr-3 text-xs font-semibold text-navy hover:underline"
                    >
                      Modifier
                    </Link>
                    <form action={deleteConsultant.bind(null, c.id)} className="inline">
                      <button className="text-xs font-semibold text-rose-dark hover:underline">
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-navy/50">
        Pour donner l&apos;accès au portail à un revendeur, créez son compte depuis{" "}
        <Link href="/admin/utilisateurs" className="underline">
          Utilisateurs
        </Link>{" "}
        avec le rôle « Consultant » et rattachez-le à sa fiche.
      </p>
    </div>
  );
}
