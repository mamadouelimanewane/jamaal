import Link from "next/link";
import { Banknote, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getReseller, startOfMonth } from "@/lib/reseller";
import { StatCard } from "@/components/admin/StatCard";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

const PERIODS = {
  "30j": { label: "30 derniers jours", since: () => new Date(Date.now() - 30 * 86_400_000) },
  mois: { label: "Ce mois-ci", since: () => startOfMonth() },
  tout: { label: "Depuis le début", since: () => new Date(0) },
} as const;

const STATUS: Record<string, { label: string; cls: string }> = {
  EN_ATTENTE: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  CONFIRMEE: { label: "Confirmée", cls: "bg-blue-100 text-blue-800" },
  EXPEDIEE: { label: "Expédiée", cls: "bg-purple-100 text-purple-800" },
  LIVREE: { label: "Livrée", cls: "bg-emerald-100 text-emerald-800" },
  ANNULEE: { label: "Annulée", cls: "bg-navy/10 text-navy/60" },
};

export default async function MesVentesPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const { periode } = await searchParams;
  const key = (periode && periode in PERIODS ? periode : "30j") as keyof typeof PERIODS;
  const since = PERIODS[key].since();

  const orders = await prisma.order.findMany({
    where: { consultantId: me.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, createdAt: true, customerName: true, customerPhone: true, total: true, status: true, paymentStatus: true, items: { select: { productName: true, quantity: true } } },
  });

  const valid = orders.filter((o) => o.status !== "ANNULEE");
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const average = valid.length ? Math.round(revenue / valid.length) : 0;
  const pending = orders.filter((o) => o.status === "EN_ATTENTE" || o.status === "CONFIRMEE" || o.status === "EXPEDIEE").length;

  // Produits les plus vendus sur la période
  const sold = new Map<string, number>();
  for (const o of valid) for (const i of o.items) sold.set(i.productName, (sold.get(i.productName) ?? 0) + i.quantity);
  const top = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes ventes</h1>
          <p className="mt-1 text-sm text-navy/60">Le chiffre d&apos;affaires généré par vos clients, via votre lien ou vos commandes saisies.</p>
        </div>
        <Link href="/admin/mes-commandes/nouvelle" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
          + Nouvelle vente
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((k) => (
          <Link
            key={k}
            href={`/admin/mes-ventes?periode=${k}`}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${k === key ? "border-navy bg-navy text-white" : "border-line text-navy hover:bg-cream"}`}
          >
            {PERIODS[k].label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={formatPrice(revenue)} icon={Banknote} color="emerald" />
        <StatCard label="Commandes (hors annulées)" value={valid.length} icon={ShoppingBag} color="navy" />
        <StatCard label="Panier moyen" value={formatPrice(average)} icon={Receipt} color="rose" />
        <StatCard label="En cours de traitement" value={pending} icon={TrendingUp} color="amber" />
      </div>

      {top.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Vos produits les plus vendus</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {top.map(([name, qty]) => (
              <li key={name} className="flex items-center justify-between gap-3 py-2">
                <span className="text-navy/80">{name}</span>
                <span className="shrink-0 font-semibold text-navy">{qty} vendu{qty > 1 ? "s" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-navy/60">{o.createdAt.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy">{o.customerName}</p>
                  {o.customerPhone && <p className="text-xs text-navy/50">{o.customerPhone}</p>}
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-navy/70">
                  {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ").slice(0, 120)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-navy">{formatPrice(o.total)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[o.status]?.cls}`}>{STATUS[o.status]?.label}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/mes-commandes/${o.id}`} className="text-xs font-semibold text-rose-dark hover:underline">Détail</Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-navy/50">Aucune vente sur cette période. Partagez votre lien personnel (voir « Mon marketing ») pour démarrer.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
