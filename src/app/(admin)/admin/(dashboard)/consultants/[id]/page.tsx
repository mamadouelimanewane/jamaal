import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getConsultantCommission } from "@/lib/commission";
import {
  getConsultantRank,
  getProgressToNextRank,
  getConsultantRankHistory,
} from "@/lib/ranking";
import { RankBadge } from "@/components/admin/RankBadge";
import {
  TrendingUp,
  ShoppingCart,
  Wallet,
  ArrowLeft,
  Phone,
  MapPin,
  Mail,
  Edit,
  BarChart3,
  Star,
  Users,
  Award,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function ConsultantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [consultant, rankInfo, commission, rankHistory] = await Promise.all([
    prisma.consultant.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, id: true } },
        sponsor: { select: { id: true, name: true, city: true } },
        sponsored: {
          select: {
            id: true,
            name: true,
            city: true,
            active: true,
            orders: { select: { total: true, status: true } },
          },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { items: true },
        },
        commissionPayments: { orderBy: { paidAt: "desc" }, take: 10 },
        targets: {
          where: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
          },
        },
      },
    }),
    getConsultantRank(id),
    getConsultantCommission(id),
    getConsultantRankHistory(id, 6),
  ]);

  if (!consultant) notFound();

  const progress = getProgressToNextRank(rankInfo);
  const totalOrderCount = await prisma.order.count({
    where: { consultantId: id, status: { not: "ANNULEE" } },
  });

  const totalPaid = consultant.commissionPayments.reduce(
    (s, p) => s + p.amount,
    0
  );
  const totalCommissionDue =
    commission.lifetimeCommission +
    commission.lifetimeSponsorCommission +
    commission.lifetimeL2Commission;
  const netDue = Math.max(0, totalCommissionDue - totalPaid);

  const currentTarget = consultant.targets[0]?.targetRevenue ?? null;
  const targetProgress = currentTarget
    ? Math.min(100, Math.round((commission.monthlyRevenue / currentTarget) * 100))
    : null;

  return (
    <div className="max-w-5xl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/consultants"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif-display text-2xl font-semibold text-navy">
                {consultant.name}
              </h1>
              <RankBadge rank={rankInfo.rank} />
              {consultant.active ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Actif
                </span>
              ) : (
                <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-navy/40">
                  Inactif
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-navy/60">
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {consultant.city}
              </span>
              {consultant.email && (
                <span className="flex items-center gap-1">
                  <Mail size={11} />
                  {consultant.email}
                </span>
              )}
              <a
                href={consultant.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
              >
                <Phone size={11} />
                WhatsApp
              </a>
              {consultant.user && (
                <span className="flex items-center gap-1 text-blue-600">
                  Portail: {consultant.user.email}
                </span>
              )}
              {consultant.sponsor && (
                <span>
                  Parrain :{" "}
                  <Link
                    href={`/admin/consultants/${consultant.sponsor.id}`}
                    className="font-semibold text-navy hover:underline"
                  >
                    {consultant.sponsor.name} ({consultant.sponsor.city})
                  </Link>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/consultants/${id}/modifier`}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
          >
            <Edit size={13} />
            Modifier
          </Link>
          <Link
            href={`/admin/consultants/${id}/equipe`}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
          >
            <Users size={13} />
            Équipe ({consultant.sponsored.length})
          </Link>
          <Link
            href={`/admin/consultants/${id}/commandes`}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
          >
            <ShoppingCart size={13} />
            Commandes
          </Link>
          <Link
            href={`/admin/consultants/${id}/objectif`}
            className="flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
          >
            <Star size={13} />
            Objectif
          </Link>
          <Link
            href={`/admin/consultants/${id}/paiement`}
            className="flex items-center gap-1.5 rounded-full bg-rose-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Wallet size={13} />
            Payer commission
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "CA Ce Mois",
            value: formatPrice(commission.monthlyRevenue),
            icon: <TrendingUp size={20} className="text-emerald-600" />,
            sub: `Commission : ${formatPrice(commission.monthlyCommission)}`,
          },
          {
            label: "CA Lifetime",
            value: formatPrice(commission.lifetimeRevenue),
            icon: <BarChart3 size={20} className="text-blue-500" />,
            sub: `Commission : ${formatPrice(commission.lifetimeCommission)}`,
          },
          {
            label: "Commandes",
            value: String(totalOrderCount),
            icon: <ShoppingCart size={20} className="text-purple-500" />,
            sub: `${consultant.sponsored.length} filleul(s) parrainé(s)`,
          },
          {
            label: "Commission Nette Due",
            value: formatPrice(netDue),
            icon: <Wallet size={20} className="text-amber-600" />,
            sub: `Déjà payé : ${formatPrice(totalPaid)}`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">
                {kpi.label}
              </p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream">
                {kpi.icon}
              </div>
            </div>
            <p className="mt-3 text-xl font-bold text-navy">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-navy/50">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Commissions MLM table ── */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy">
          <Award size={18} className="text-amber-600" />
          Détail des Commissions MLM (multi-niveaux)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="pb-2 pr-4">Niveau</th>
                <th className="pb-2 pr-4">Taux</th>
                <th className="pb-2 pr-4">CA (Ce Mois)</th>
                <th className="pb-2 pr-4">Commission (Ce Mois)</th>
                <th className="pb-2 pr-4">CA (Lifetime)</th>
                <th className="pb-2">Commission (Lifetime)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-2.5 pr-4 font-medium text-navy">Ventes directes</td>
                <td className="py-2.5 pr-4">{commission.rate}%</td>
                <td className="py-2.5 pr-4 text-navy/70">{formatPrice(commission.monthlyRevenue)}</td>
                <td className="py-2.5 pr-4 font-semibold text-emerald-700">{formatPrice(commission.monthlyCommission)}</td>
                <td className="py-2.5 pr-4 text-navy/70">{formatPrice(commission.lifetimeRevenue)}</td>
                <td className="py-2.5 font-semibold text-emerald-700">{formatPrice(commission.lifetimeCommission)}</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-navy">Filleuls N1</td>
                <td className="py-2.5 pr-4">{commission.sponsorRate}%</td>
                <td className="py-2.5 pr-4 text-navy/70">{formatPrice(commission.monthlyTeamRevenue)}</td>
                <td className="py-2.5 pr-4 font-semibold text-blue-600">{formatPrice(commission.monthlySponsorCommission)}</td>
                <td className="py-2.5 pr-4 text-navy/70">{formatPrice(commission.lifetimeTeamRevenue)}</td>
                <td className="py-2.5 font-semibold text-blue-600">{formatPrice(commission.lifetimeSponsorCommission)}</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-navy">Filleuls N2</td>
                <td className="py-2.5 pr-4">{commission.sponsorL2Rate}%</td>
                <td className="py-2.5 pr-4 text-navy/70">{formatPrice(commission.monthlyL2Revenue)}</td>
                <td className="py-2.5 pr-4 font-semibold text-purple-600">{formatPrice(commission.monthlyL2Commission)}</td>
                <td className="py-2.5 pr-4 text-navy/70">{formatPrice(commission.lifetimeL2Revenue)}</td>
                <td className="py-2.5 font-semibold text-purple-600">{formatPrice(commission.lifetimeL2Commission)}</td>
              </tr>
              <tr className="bg-cream/50">
                <td className="py-2.5 pr-4 font-bold text-navy">TOTAL</td>
                <td className="py-2.5 pr-4">—</td>
                <td className="py-2.5 pr-4 font-bold text-navy">{formatPrice(commission.monthlyRevenue + commission.monthlyTeamRevenue + commission.monthlyL2Revenue)}</td>
                <td className="py-2.5 pr-4 font-bold text-emerald-700">{formatPrice(commission.monthlyCommission + commission.monthlySponsorCommission + commission.monthlyL2Commission)}</td>
                <td className="py-2.5 pr-4 font-bold text-navy">{formatPrice(commission.lifetimeRevenue + commission.lifetimeTeamRevenue + commission.lifetimeL2Revenue)}</td>
                <td className="py-2.5 font-bold text-emerald-700">{formatPrice(totalCommissionDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ── Historique rangs ── */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">Historique des Rangs (6 mois)</h2>
          <div className="space-y-2">
            {rankHistory.map((m) => (
              <div
                key={m.label}
                className="flex items-center justify-between rounded-xl bg-cream/50 px-3 py-2"
              >
                <span className="text-xs font-medium capitalize text-navy/70">
                  {m.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-navy/50">
                    {formatPrice(m.monthlyRevenue)}
                  </span>
                  <RankBadge rank={m.rank} />
                </div>
              </div>
            ))}
          </div>
          {progress.nextRank && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
              <p className="font-semibold">
                🎯 Pour atteindre le rang {progress.nextRank} :
              </p>
              {progress.revenueNeeded > 0 && (
                <p>CA manquant : {formatPrice(progress.revenueNeeded)}</p>
              )}
              {progress.sponsoredNeeded > 0 && (
                <p>Filleuls actifs manquants : {progress.sponsoredNeeded}</p>
              )}
            </div>
          )}
          {rankInfo.rank === "GOLD" && (
            <p className="mt-3 text-center text-xs font-semibold text-amber-600">
              🥇 Rang Maximum atteint ce mois !
            </p>
          )}
        </div>

        {/* ── Objectif + Équipe ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-navy">Objectif du Mois</h2>
              <Link
                href={`/admin/consultants/${id}/objectif`}
                className="text-xs font-semibold text-navy hover:underline"
              >
                Modifier →
              </Link>
            </div>
            {currentTarget ? (
              <div className="mt-3">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-navy">
                    {formatPrice(commission.monthlyRevenue)}
                  </span>
                  <span className="text-navy/50">
                    sur {formatPrice(currentTarget)}
                  </span>
                </div>
                <div className="mt-1.5 h-3 w-full rounded-full bg-cream">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      targetProgress! >= 100
                        ? "bg-emerald-500"
                        : targetProgress! >= 60
                        ? "bg-amber-400"
                        : "bg-rose-dark"
                    }`}
                    style={{ width: `${targetProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs font-bold text-navy/70">
                  {targetProgress}%
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-navy/40">
                Aucun objectif fixé.{" "}
                <Link
                  href={`/admin/consultants/${id}/objectif`}
                  className="underline"
                >
                  En fixer un →
                </Link>
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-navy">
                Équipe ({consultant.sponsored.length} filleul(s))
              </h2>
              <Link
                href={`/admin/consultants/${id}/equipe`}
                className="text-xs font-semibold text-navy hover:underline"
              >
                Voir tout →
              </Link>
            </div>
            {consultant.sponsored.length === 0 ? (
              <p className="mt-2 text-xs text-navy/40">Aucun filleul enregistré.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {consultant.sponsored.slice(0, 6).map((s) => {
                  const rev = s.orders
                    .filter((o) => o.status !== "ANNULEE")
                    .reduce((sum, o) => sum + o.total, 0);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <Link
                        href={`/admin/consultants/${s.id}`}
                        className="font-medium text-navy hover:underline"
                      >
                        {s.name}{" "}
                        <span className="text-navy/40">({s.city})</span>
                      </Link>
                      <span className="font-semibold text-navy/70">
                        {formatPrice(rev)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 10 dernières commandes ── */}
      <div className="mt-6 rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy">Dernières Commandes</h2>
          <Link
            href={`/admin/consultants/${id}/commandes`}
            className="text-xs font-semibold text-navy hover:underline"
          >
            Voir tout →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {consultant.orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-navy/40">
                    Aucune commande
                  </td>
                </tr>
              )}
              {consultant.orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{o.customerName}</p>
                    <p className="text-xs text-navy/50">{o.customerPhone ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-navy/60">
                    {o.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-navy/60">{o.items.length} art.</td>
                  <td className="px-4 py-3 font-semibold text-navy">
                    {formatPrice(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        o.status === "LIVREE"
                          ? "bg-emerald-50 text-emerald-700"
                          : o.status === "ANNULEE"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/commandes/${o.id}`}
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Historique versements commission ── */}
      <div className="mt-6 rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold text-navy">Versements de Commission</h2>
            <p className="text-xs text-navy/50">
              Total payé : {formatPrice(totalPaid)} · Net restant dû :{" "}
              <span className="font-semibold text-rose-dark">{formatPrice(netDue)}</span>
            </p>
          </div>
          <Link
            href={`/admin/consultants/${id}/paiement`}
            className="rounded-full bg-rose-dark px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            + Enregistrer un versement
          </Link>
        </div>
        {consultant.commissionPayments.length === 0 ? (
          <p className="px-5 py-6 text-xs text-navy/40">Aucun versement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {consultant.commissionPayments.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-navy">{p.periodLabel}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">
                    {formatPrice(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-navy/60">{p.note ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/60">
                    {p.paidAt.toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
