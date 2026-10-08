import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteLivreur } from "@/lib/actions/livreurs";

export const dynamic = "force-dynamic";

export default async function AdminLivreursPage() {
  const livreurs = await prisma.livreur.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Livreurs ({livreurs.length})
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/livreurs/carte"
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            🗺️ Carte flotte GPS
          </Link>
          <Link
            href="/admin/livreurs/nouveau"
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + Nouveau livreur
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone / WhatsApp</th>
              <th className="px-4 py-3">Livraisons</th>
              <th className="px-4 py-3">Dernière position</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {livreurs.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{l.name}</td>
                <td className="px-4 py-3 text-navy/85">{l.phone}</td>
                <td className="px-4 py-3 text-navy/85">{l._count.orders}</td>
                <td className="px-4 py-3 text-navy/85">
                  {l.lastLat && l.lastLng ? (
                    <a
                      href={`https://www.google.com/maps?q=${l.lastLat},${l.lastLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      Voir sur la carte
                    </a>
                  ) : (
                    <span className="text-xs text-navy/65">Non partagée</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.active ? (
                    <span className="text-xs font-semibold text-green-700">Actif</span>
                  ) : (
                    <span className="text-xs font-semibold text-navy/65">Inactif</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/livreurs/${l.id}/modifier`}
                    className="mr-3 text-xs font-semibold text-navy hover:underline"
                  >
                    Modifier
                  </Link>
                  <form action={deleteLivreur.bind(null, l.id)} className="inline">
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
