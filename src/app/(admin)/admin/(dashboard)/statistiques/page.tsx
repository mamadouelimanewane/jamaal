import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { BarList } from "@/components/admin/BarList";
import { DailyRevenueChart } from "@/components/admin/DailyRevenueChart";
import { getAnalyticsFunnel } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const channelLabels: Record<string, string> = { SITE: "Site", WHATSAPP: "WhatsApp", REVENDEUR: "Revendeur", CATALOGUE: "Catalogue WhatsApp" };

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<{ jours?: string; produit?: string; vendeur?: string; source?: string }> }) {
  const params = await searchParams;
  const allowedDays = [7, 30, 90];
  const daysSelected = allowedDays.includes(Number(params.jours)) ? Number(params.jours) : 30;
  const [funnelProducts, funnelConsultants] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const productId = funnelProducts.some((p) => p.id === params.produit) ? params.produit : undefined;
  const consultantId = funnelConsultants.some((c) => c.id === params.vendeur) ? params.vendeur : undefined;
  const allowedSources = ["SITE", "VENDEUR", "WHATSAPP", "REVENDEUR", "CATALOGUE"];
  const source = allowedSources.includes(params.source ?? "") ? params.source : undefined;
  const [dailyRaw, statusGroups, topProducts, topConsultantsRaw, channelGroups, funnel] = await Promise.all([
    prisma.$queryRaw<{ date: string; total: bigint }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') as date, SUM(total)::bigint as total
      FROM "Order"
      WHERE status != 'ANNULEE' AND "createdAt" >= now() - (${daysSelected} * interval '1 day')
      GROUP BY date
      ORDER BY date
    `,
    prisma.order.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: daysAgo(daysSelected) } } }),
    prisma.orderItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      where: { order: { is: { createdAt: { gte: daysAgo(daysSelected) }, status: { not: "ANNULEE" } } } },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
    prisma.order.groupBy({
      by: ["consultantId"],
      _sum: { total: true },
      where: { consultantId: { not: null }, status: { not: "ANNULEE" }, createdAt: { gte: daysAgo(daysSelected) } },
      orderBy: { _sum: { total: "desc" } },
      take: 6,
    }),
    prisma.order
      .groupBy({ by: ["channel"], _count: { _all: true }, _sum: { total: true }, where: { status: { not: "ANNULEE" }, createdAt: { gte: daysAgo(daysSelected) } } })
      .catch(() => []),
    getAnalyticsFunnel(daysSelected, { productId, consultantId, source }).catch(() => []),
  ]);

  const dailyMap = new Map(dailyRaw.map((d) => [d.date, Number(d.total)]));
  const days: { date: string; total: number }[] = [];
  for (let i = daysSelected - 1; i >= 0; i--) {
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
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-navy/75">Performance des {daysSelected} derniers jours.</p><nav aria-label="Période des statistiques" className="flex gap-2">{allowedDays.map((n)=><a key={n} href={`/admin/statistiques?jours=${n}&produit=${productId??""}&vendeur=${consultantId??""}&source=${source??""}`} aria-current={daysSelected===n?"page":undefined} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${daysSelected===n?"border-navy bg-navy text-white":"border-line bg-white text-navy"}`}>{n} jours</a>)}</nav></div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy">Chiffre d&apos;affaires par jour ({daysSelected} jours)</h2>
        <DailyRevenueChart data={days} />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-navy">Commandes par canal ({daysSelected} jours)</h2>
        <p className="mb-4 text-xs text-navy/60">Site, assistant WhatsApp et commandes saisies par les revendeurs : les canaux se complètent.</p>
        <BarList
          items={channelGroups.map((g) => ({ label: `${channelLabels[g.channel] ?? g.channel} · ${g._count._all} commande(s)`, value: g._sum.total ?? 0 }))}
          formatValue={(v) => formatPrice(v)}
          color="emerald"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-navy">Parcours d&apos;achat ({daysSelected} jours)</h2>
        <p className="mb-4 text-xs text-navy/60">Sessions temporaires du navigateur, du produit au paiement. Les filtres appliquent le rattachement d’attribution enregistré avec les événements.</p>
        <form action="/admin/statistiques" method="get" className="mb-4 grid gap-3 rounded-xl bg-cream/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="jours" value={daysSelected}/>
          <label className="text-xs font-medium text-navy">Produit<select name="produit" defaultValue={productId??""} className="mt-1 w-full rounded-lg border border-line bg-white p-2"><option value="">Tous les produits</option>{funnelProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-xs font-medium text-navy">Vendeur référent<select name="vendeur" defaultValue={consultantId??""} className="mt-1 w-full rounded-lg border border-line bg-white p-2"><option value="">Tous les vendeurs</option>{funnelConsultants.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-xs font-medium text-navy">Canal / source<select name="source" defaultValue={source??""} className="mt-1 w-full rounded-lg border border-line bg-white p-2"><option value="">Toutes les sources</option><option value="SITE">Site direct</option><option value="VENDEUR">Lien vendeur</option><option value="WHATSAPP">WhatsApp</option><option value="REVENDEUR">Vente saisie par vendeur</option><option value="CATALOGUE">Catalogue WhatsApp</option></select></label>
          <button className="self-end rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Appliquer les filtres</button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {funnel.map((step) => (
            <div key={step.name} className="rounded-xl border border-line bg-cream/40 px-4 py-3">
              <p className="text-xs font-medium text-navy/70">{step.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-navy">{step.sessions.toLocaleString("fr-FR")} <span className="text-xs font-normal text-navy/55">sessions</span></p>
              <p className="mt-1 text-xs text-navy/60">{step.events.toLocaleString("fr-FR")} événements · {step.rate}% des sessions avec vue produit</p>
            </div>
          ))}
        </div>
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
