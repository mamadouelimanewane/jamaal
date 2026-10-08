import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { BarList } from "@/components/admin/BarList";
import { DailyRevenueChart } from "@/components/admin/DailyRevenueChart";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminStatsPage() {
  const [dailyRaw, statusGroups, topProducts, topConsultantsRaw] = await Promise.all([
    prisma.$queryRaw<{ date: string; total: bigint }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') as date, SUM(total)::bigint as total
      FROM "Order"
      WHERE status != 'ANNULEE' AND "createdAt" >= now() - interval '30 days'
      GROUP BY date
      ORDER BY date
    `,
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.orderItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
    prisma.order.groupBy({
      by: ["consultantId"],
      _sum: { total: true },
      where: { consultantId: { not: null }, status: { not: "ANNULEE" } },
      orderBy: { _sum: { total: "desc" } },
      take: 6,
    }),
  ]);

  const dailyMap = new Map(dailyRaw.map((d) => [d.date, Number(d.total)]));
  const days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, total: dailyMap.get(key) ?? 0 });
  }

  const consultantIds = topConsultantsRaw.map((c) => c.consultantId).filter((id): id is string => !!id);
  const consultants = await prisma.consultant.findMany({ where: { id: { in: consultantIds } } });
  const consultantName = new Map(consultants.map((c) => [c.id, c.name]));

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Statistiques</h1>
      <p className="mt-1 text-sm text-navy/75">Performance des 30 derniers jours.</p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy">Chiffre d&apos;affaires par jour</h2>
        <DailyRevenueChart data={days} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-navy">Commandes par statut</h2>
          <BarList
            items={statusGroups.map((g) => ({ label: statusLabels[g.status] ?? g.status, value: g._count._all }))}
            color="navy"
          />
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-navy">Produits les plus vendus</h2>
          <BarList
            items={topProducts.map((p) => ({ label: p.productName, value: p._sum.quantity ?? 0 }))}
            color="rose"
          />
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-navy">Top consultants (CA)</h2>
          <BarList
            items={topConsultantsRaw.map((c) => ({
              label: consultantName.get(c.consultantId ?? "") ?? "Inconnu",
              value: c._sum.total ?? 0,
            }))}
            formatValue={(v) => formatPrice(v)}
            color="emerald"
          />
        </div>
      </div>
    </div>
  );
}
