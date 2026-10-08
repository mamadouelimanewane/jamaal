import Link from "next/link";
import {
  Package,
  ShoppingCart,
  Users,
  Bike,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Contact,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { StatCard } from "@/components/admin/StatCard";
import { RankBadge } from "@/components/admin/RankBadge";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { MonthlyLeaderboard } from "@/components/admin/MonthlyLeaderboard";
import {
  getConsultantRank,
  getConsultantRankings,
  getProgressToNextRank,
  getConsultantRankHistory,
  getMonthlyLeaderboard,
  RANK_LABELS,
} from "@/lib/ranking";
import { getConsultantCommission } from "@/lib/commission";
import { getRefundedTotal } from "@/lib/revenue";
import { Undo2, FileSpreadsheet } from "lucide-react";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

async function AdminOverview() {
  const [
    productCount,
    lowStockCount,
    orderCount,
    pendingOrders,
    consultantCount,
    livreurCount,
    clientCount,
    revenueAgg,
    expenseAgg,
    refundedTotal,
    pendingReturns,
    recentOrders,
    leaderboard,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM "Product" WHERE "stock" <= "lowStockThreshold"`.then(
      (rows) => Number(rows[0]?.count ?? 0)
    ),
    prisma.order.count(),
    prisma.order.count({ where: { status: "EN_ATTENTE" } }),
    prisma.consultant.count({ where: { active: true } }),
    prisma.livreur.count({ where: { active: true } }),
    prisma.customer.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "ANNULEE" } } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    getRefundedTotal(),
    prisma.return.count({ where: { status: "EN_ATTENTE" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    getMonthlyLeaderboard(3),
  ]);

  const revenue = Math.max(0, (revenueAgg._sum.total ?? 0) - refundedTotal);
  const expenses = expenseAgg._sum.amount ?? 0;

  const cards = [
    { label: "Produits au catalogue", value: productCount, icon: Package, color: "navy" as const, href: "/admin/produits" },
    { label: "Stock bas", value: lowStockCount, icon: AlertTriangle, color: "amber" as const, href: "/admin/produits" },
    { label: "Commandes totales", value: orderCount, icon: ShoppingCart, color: "blue" as const, href: "/admin/commandes" },
    { label: "Commandes en attente", value: pendingOrders, icon: ShoppingCart, color: "red" as const, href: "/admin/commandes" },
    { label: "Retours en attente", value: pendingReturns, icon: Undo2, color: "amber" as const, href: "/admin/retours" },
    { label: "Consultants actifs", value: consultantCount, icon: Users, color: "purple" as const, href: "/admin/consultants" },
    { label: "Livreurs actifs", value: livreurCount, icon: Bike, color: "emerald" as const, href: "/admin/livreurs" },
    { label: "Clients enregistrés", value: clientCount, icon: Contact, color: "navy" as const, href: "/admin/clients" },
    { label: "Chiffre d'affaires net", value: formatPrice(revenue), icon: TrendingUp, color: "emerald" as const, href: "/admin/statistiques" },
    { label: "Dépenses totales", value: formatPrice(expenses), icon: Wallet, color: "red" as const, href: "/admin/comptabilite" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Tableau de bord</h1>
        <a
          href="/api/export/tout"
          className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          <FileSpreadsheet size={16} />
          Export complet (Excel)
        </a>
      </div>
      <p className="mt-1 text-sm text-navy/75">Vue d&apos;ensemble de l&apos;activité JAMAAL.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-serif-display text-lg font-semibold text-navy">
          🏆 Concours du mois — Top 3 consultants
        </h2>
        <MonthlyLeaderboard entries={leaderboard} />
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-serif-display text-lg font-semibold text-navy">Commandes récentes</h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-navy/75">Aucune commande pour le moment.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/70">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/admin/commandes/${o.id}`} className="font-medium text-navy hover:underline">
                        {o.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{statusLabels[o.status] ?? o.status}</td>
                    <td className="px-4 py-3">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3 text-navy/75">{o.createdAt.toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

async function ConsultantOverview({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { consultant: true } });
  if (!user?.consultant) {
    return <p className="text-sm text-navy/75">Aucun profil consultant lié à ce compte pour le moment.</p>;
  }
  const consultantId = user.consultant.id;

  const [orderCount, pending, delivered, unread, rankInfo, team, allRankings, commission, history, leaderboard] =
    await Promise.all([
      prisma.order.count({ where: { consultantId } }),
      prisma.order.count({ where: { consultantId, status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] } } }),
      prisma.order.count({ where: { consultantId, status: "LIVREE" } }),
      prisma.notification.count({ where: { userId, read: false } }),
      getConsultantRank(consultantId),
      prisma.consultant.findMany({ where: { sponsorId: consultantId }, orderBy: { name: "asc" } }),
      getConsultantRankings(),
      getConsultantCommission(consultantId),
      getConsultantRankHistory(consultantId, 6),
      getMonthlyLeaderboard(50),
    ]);

  const rankById = new Map(allRankings.map((r) => [r.consultantId, r]));
  const progress = getProgressToNextRank(rankInfo);
  const myPosition = leaderboard.findIndex((e) => e.consultantId === consultantId);

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Bonjour {user.consultant.name}
        </h1>
        <RankBadge rank={rankInfo.rank} />
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Votre espace consultant JAMAAL — CA de ce mois-ci : {formatPrice(rankInfo.monthlyRevenue)}
        {myPosition >= 0 && ` · #${myPosition + 1} au classement du mois`}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Mes commandes" value={orderCount} icon={ShoppingCart} color="navy" href="/admin/mes-commandes" />
        <StatCard label="En cours" value={pending} icon={Truck} color="amber" href="/admin/mes-commandes" />
        <StatCard label="Livrées" value={delivered} icon={CheckCircle2} color="emerald" href="/admin/mes-commandes" />
        <StatCard label="Notifications" value={unread} icon={Users} color="rose" href="/admin/notifications" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">Commission ({commission.rate}%)</p>
          <p className="mt-2 text-2xl font-semibold text-navy">{formatPrice(commission.monthlyCommission)}</p>
          <p className="text-xs text-navy/70">ce mois-ci</p>
          <p className="mt-3 text-sm text-navy/85">
            Total gagné depuis le début : <span className="font-semibold">{formatPrice(commission.lifetimeCommission)}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          {progress.nextRank ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">
                Vers le rang {RANK_LABELS[progress.nextRank]}
              </p>
              <div className="mt-3">
                <ProgressBar
                  value={
                    progress.revenueNeeded === 0
                      ? 100
                      : (rankInfo.monthlyRevenue / (rankInfo.monthlyRevenue + progress.revenueNeeded)) * 100
                  }
                  color="amber"
                />
              </div>
              <p className="mt-2 text-sm text-navy/85">
                Il vous manque {formatPrice(progress.revenueNeeded)} de CA{" "}
                {progress.sponsoredNeeded > 0 && <>ou {progress.sponsoredNeeded} filleul(s) actif(s) de plus</>} pour
                passer {RANK_LABELS[progress.nextRank]}.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">Rang</p>
              <p className="mt-3 text-sm font-semibold text-amber-700">
                🥇 Vous êtes au rang maximum ce mois-ci, bravo !
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">Votre historique de rang</h2>
        <div className="flex gap-2 overflow-x-auto">
          {history.map((h) => (
            <div
              key={`${h.year}-${h.month}`}
              className="flex min-w-[84px] flex-col items-center gap-2 rounded-xl border border-line bg-white p-3"
            >
              <span className="text-xs capitalize text-navy/70">{h.label}</span>
              <RankBadge rank={h.rank} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-1 font-serif-display text-lg font-semibold text-navy">Mon équipe</h2>
        <p className="mb-4 text-sm text-navy/75">
          Les consultants que vous avez parrainés. Un filleul actif ce mois-ci vous fait progresser dans le classement.
        </p>
        {team.length === 0 ? (
          <p className="text-sm text-navy/70">
            Vous n&apos;avez pas encore de filleul. Parlez de JAMAAL autour de vous sur WhatsApp !
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {team.map((member) => {
              const info = rankById.get(member.id);
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-navy">{member.name}</p>
                    <p className="text-xs text-navy/70">{member.city}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {info && info.monthlyRevenue > 0 ? (
                      <span className="text-xs text-emerald-700">Actif ce mois-ci</span>
                    ) : (
                      <span className="text-xs text-navy/65">Pas encore de vente ce mois-ci</span>
                    )}
                    <RankBadge rank={info?.rank ?? null} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

async function LivreurOverview({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { livreur: true } });
  if (!user?.livreur) {
    return <p className="text-sm text-navy/75">Aucun profil livreur lié à ce compte pour le moment.</p>;
  }
  const livreurId = user.livreur.id;

  const [assigned, pending, delivered] = await Promise.all([
    prisma.order.count({ where: { livreurId } }),
    prisma.order.count({ where: { livreurId, status: { in: ["CONFIRMEE", "EXPEDIEE"] } } }),
    prisma.order.count({ where: { livreurId, status: "LIVREE" } }),
  ]);

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Bonjour {user.livreur.name}
      </h1>
      <p className="mt-1 text-sm text-navy/75">Vos livraisons JAMAAL.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Livraisons assignées" value={assigned} icon={Truck} color="navy" href="/admin/mes-livraisons" />
        <StatCard label="À livrer" value={pending} icon={AlertTriangle} color="amber" href="/admin/mes-livraisons" />
        <StatCard label="Livrées" value={delivered} icon={CheckCircle2} color="emerald" href="/admin/mes-livraisons" />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "CONSULTANT" && session?.user?.id) return <ConsultantOverview userId={session.user.id} />;
  if (role === "LIVREUR" && session?.user?.id) return <LivreurOverview userId={session.user.id} />;
  return <AdminOverview />;
}
