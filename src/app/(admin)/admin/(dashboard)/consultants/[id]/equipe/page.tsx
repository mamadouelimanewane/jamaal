import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getConsultantRankings } from "@/lib/ranking";
import { RankBadge } from "@/components/admin/RankBadge";
import { ArrowLeft, Users, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConsultantEquipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!consultant) notFound();

  // Filleuls N1
  const level1 = await prisma.consultant.findMany({
    where: { sponsorId: id },
    include: {
      orders: { select: { total: true, status: true, createdAt: true } },
      sponsored: { select: { id: true, name: true } },
      commissionPayments: { select: { amount: true } },
    },
    orderBy: { name: "asc" },
  });

  const l1Ids = level1.map((c) => c.id);

  // Filleuls N2
  const level2 = await prisma.consultant.findMany({
    where: { sponsorId: { in: l1Ids } },
    include: {
      orders: { select: { total: true, status: true } },
      sponsor: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const rankings = await getConsultantRankings();
  const rankById = new Map(rankings.map((r) => [r.consultantId, r]));

  const totalTeamRevenue = [...level1, ...level2]
    .flatMap((c) => c.orders)
    .filter((o) => o.status !== "ANNULEE")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/consultants/${id}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Équipe de {consultant.name}
            </h1>
            <p className="text-sm text-navy/60">
              {level1.length} filleul(s) N1 · {level2.length} filleul(s) N2 · CA équipe total :{" "}
              <span className="font-semibold text-navy">{formatPrice(totalTeamRevenue)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Niveau 1 ── */}
      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy">
          <Users size={18} className="text-blue-500" />
          Filleuls Niveau 1 ({level1.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="px-4 py-3">Rang</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">CA Total</th>
                <th className="px-4 py-3">CA Ce Mois</th>
                <th className="px-4 py-3">Ses Filleuls</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {level1.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-navy/40">
                    <UserPlus className="mx-auto mb-2 text-navy/20" size={28} />
                    Aucun filleul N1 pour ce revendeur.
                  </td>
                </tr>
              )}
              {level1.map((c) => {
                const total = c.orders
                  .filter((o) => o.status !== "ANNULEE")
                  .reduce((s, o) => s + o.total, 0);
                const info = rankById.get(c.id);
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <RankBadge rank={info?.rank ?? null} />
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                    <td className="px-4 py-3 text-navy/60">{c.city}</td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(total)}</td>
                    <td className="px-4 py-3 text-emerald-700 font-medium">
                      {formatPrice(info?.monthlyRevenue ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-navy/60">{c.sponsored.length}</td>
                    <td className="px-4 py-3">
                      {info?.activeSponsoredCount !== undefined && info.activeSponsoredCount > 0 ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Actif ce mois
                        </span>
                      ) : (
                        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-navy/40">
                          Inactif ce mois
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/consultants/${c.id}`}
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        Voir fiche →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Niveau 2 ── */}
      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy">
          <Users size={18} className="text-purple-500" />
          Filleuls Niveau 2 ({level2.length})
        </h2>
        {level2.length === 0 ? (
          <div className="rounded-2xl border border-line bg-cream/50 px-5 py-8 text-center text-sm text-navy/40">
            Aucun filleul de niveau 2 encore.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="px-4 py-3">Rang</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Via (N1)</th>
                  <th className="px-4 py-3">CA Total</th>
                  <th className="px-4 py-3">CA Ce Mois</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {level2.map((c) => {
                  const total = c.orders
                    .filter((o) => o.status !== "ANNULEE")
                    .reduce((s, o) => s + o.total, 0);
                  const info = rankById.get(c.id);
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <RankBadge rank={info?.rank ?? null} />
                      </td>
                      <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                      <td className="px-4 py-3 text-xs text-navy/60">
                        {c.sponsor ? (
                          <Link
                            href={`/admin/consultants/${c.sponsor.id}`}
                            className="hover:underline"
                          >
                            {c.sponsor.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatPrice(total)}</td>
                      <td className="px-4 py-3 text-emerald-700 font-medium">
                        {formatPrice(info?.monthlyRevenue ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/consultants/${c.id}`}
                          className="text-xs font-semibold text-navy hover:underline"
                        >
                          Voir fiche →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
