import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteConsultant } from "@/lib/actions/consultants";

export const dynamic = "force-dynamic";

export default async function AdminConsultantsPage() {
  const consultants = await prisma.consultant.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Consultants ({consultants.length})
        </h1>
        <Link
          href="/admin/consultants/nouveau"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + Nouveau consultant
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {consultants.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                <td className="px-4 py-3 text-navy/70">{c.city}</td>
                <td className="px-4 py-3 text-navy/70">{c.whatsapp}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
