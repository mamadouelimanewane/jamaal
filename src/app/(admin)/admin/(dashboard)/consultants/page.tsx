import Link from "next/link";
import { depthFromLoaded, titleForDepth } from "@/lib/network";
import { NetworkTitleBadge } from "@/components/admin/NetworkTitleBadge";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { deleteConsultant } from "@/lib/actions/consultants";
import { startViewAsReseller } from "@/lib/actions/view-as";
import { ResellerAccess } from "@/components/admin/ResellerAccess";
import { getConsultantRankings } from "@/lib/ranking";
import { RankBadge } from "@/components/admin/RankBadge";

export const dynamic = "force-dynamic";

const rankOrder = { GOLD: 0, SILVER: 1, BRONZE: 2 } as const;

export default async function AdminConsultantsPage() {
  const [consultants, rankings] = await Promise.all([
    prisma.consultant.findMany({
      include: {
        user: true,
        sponsor: { select: { name: true, sponsorId: true } },
        orders: { select: { total: true, status: true } },
      },
    }),
    getConsultantRankings(),
  ]);

  const rankById = new Map(rankings.map((r) => [r.consultantId, r]));

  const sorted = [...consultants].sort((a, b) => {
    const ra = rankById.get(a.id)?.rank ?? null;
    const rb = rankById.get(b.id)?.rank ?? null;
    const oa = ra ? rankOrder[ra] : 3;
    const ob = rb ? rankOrder[rb] : 3;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Consultants ({consultants.length})
        </h1>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export/revendeurs"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            Exporter Excel ↓
          </a>
          <Link
            href="/admin/consultants/nouveau"
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + Nouveau
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Classement du mois en cours — Gold, Silver puis Bronze selon le CA généré et les filleuls actifs.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Rang</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Parrain</th>
              <th className="px-4 py-3">Ventes</th>
              <th className="px-4 py-3">Compte portail</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const revenue = c.orders
                .filter((o) => o.status !== "ANNULEE")
                .reduce((sum, o) => sum + o.total, 0);
              const info = rankById.get(c.id);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <RankBadge rank={info?.rank ?? null} />
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">
                    <a
                      href={c.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {c.name}
                    </a>
                    <span className="ml-2 align-middle"><NetworkTitleBadge title={titleForDepth(depthFromLoaded(c))} /></span>
                  </td>
                  <td className="px-4 py-3 text-navy/85">{c.city}</td>
                  <td className="px-4 py-3 text-navy/85">{c.sponsor?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/85">
                    {c.orders.length} commande(s) — {formatPrice(revenue)}
                    {info && info.activeSponsoredCount > 0 && (
                      <span className="ml-1 text-xs text-navy/70">
                        · {info.activeSponsoredCount} filleul(s) actif(s)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ResellerAccess consultantId={c.id} userEmail={c.user?.email ?? null} defaultEmail={c.email ?? ""} whatsapp={c.whatsapp} name={c.name} />
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <span className="text-xs font-semibold text-green-700">Actif</span>
                    ) : (
                      <span className="text-xs font-semibold text-navy/65">Inactif</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={startViewAsReseller.bind(null, c.id)} className="mr-3 inline">
                      <button className="text-xs font-semibold text-rose-dark hover:underline">Voir son espace</button>
                    </form>
                    <Link
                      href={`/admin/consultants/${c.id}`}
                      className="mr-3 text-xs font-semibold text-navy hover:underline"
                    >
                      Voir fiche
                    </Link>
                    <Link
                      href={`/admin/consultants/${c.id}/modifier`}
                      className="mr-3 text-xs font-semibold text-navy/75 hover:underline"
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
      <p className="mt-3 text-xs text-navy/70">
        Pour donner l&apos;accès au portail à un consultant, créez son compte depuis{" "}
        <Link href="/admin/utilisateurs" className="underline">
          Utilisateurs
        </Link>{" "}
        avec le rôle « Consultant » et rattachez-le à sa fiche.
      </p>
    </div>
  );
}
