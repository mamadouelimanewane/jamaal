import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { COMMISSIONABLE_ORDER, commissionBase } from "@/lib/commission";
import { WALLET_LABELS } from "@/lib/payouts/providers";
import { LiveRefresh } from "./LiveRefresh";

const LEVEL_LABEL: Record<string, string> = { VENTE: "Ma vente", NIVEAU_1: "Vente de mon filleul", NIVEAU_2: "Vente dans mon équipe" };

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Tableau de bord en direct d'un membre : ventes et commissions du jour, gains du mois,
 * argent en attente et versé, et fil des dernières commissions et versements.
 */
export async function LiveEarnings({ consultantId }: { consultantId: string }) {
  const today = startOfToday();
  const month = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayOrders, todayEntries, monthEntries, pending, paidMonth, entries, payouts, member] = await Promise.all([
    prisma.order.findMany({ where: { consultantId, createdAt: { gte: today }, status: { not: "ANNULEE" } }, select: { total: true, deliveryFee: true } }),
    prisma.commissionEntry.aggregate({ where: { consultantId, createdAt: { gte: today }, status: { not: "ANNULE" } }, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: { consultantId, createdAt: { gte: month }, status: { not: "ANNULE" } }, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: { consultantId, status: "A_VERSER" }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { consultantId, status: "VERSE", createdAt: { gte: month } }, _sum: { amount: true } }),
    prisma.commissionEntry.findMany({ where: { consultantId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.payout.findMany({ where: { consultantId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.consultant.findUnique({ where: { id: consultantId }, select: { walletNumber: true } }),
  ]);
  const paidToday = await prisma.order.count({ where: { ...COMMISSIONABLE_ORDER, consultantId, createdAt: { gte: today } } });

  const orders = entries.length
    ? await prisma.order.findMany({ where: { id: { in: entries.map((e) => e.orderId) } }, select: { id: true, customerName: true, consultant: { select: { name: true } } } })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));

  // Fil d'activité : commissions et versements mêlés, du plus récent au plus ancien.
  const feed = [
    ...entries.map((e) => {
      const o = orderById.get(e.orderId);
      const who = e.level === "VENTE" ? `client ${o?.customerName ?? ""}` : o?.consultant?.name ?? "";
      return {
        at: e.createdAt,
        key: `e-${e.id}`,
        title: `${LEVEL_LABEL[e.level] ?? e.level}${who ? ` · ${who}` : ""}`,
        detail: `${e.rate} % de ${formatPrice(e.base)}`,
        amount: `+ ${formatPrice(e.amount)}`,
        tone: e.status === "ANNULE" ? "text-navy/60 line-through" : "text-emerald-700",
        status: e.status === "VERSE" ? "versé" : e.status === "ANNULE" ? "annulé" : "à verser",
      };
    }),
    ...payouts.map((p) => ({
      at: p.createdAt,
      key: `p-${p.id}`,
      title: `Versement ${WALLET_LABELS[p.provider as "WAVE"] ?? p.provider}`,
      detail: p.walletNumber,
      amount: formatPrice(p.amount),
      tone: p.status === "ECHEC" ? "text-red-700" : "text-ink",
      status: p.status === "VERSE" ? "reçu" : p.status === "EN_COURS" ? "en cours" : "échec, nouvel essai prévu",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  const tiles = [
    { label: "Ventes aujourd'hui", value: `${todayOrders.length}`, sub: `${formatPrice(todayOrders.reduce((s, o) => s + commissionBase(o), 0))} · ${paidToday} payée(s)` },
    { label: "Gagné aujourd'hui", value: formatPrice(todayEntries._sum.amount ?? 0), sub: "commissions des ventes payées" },
    { label: "Gagné ce mois-ci", value: formatPrice(monthEntries._sum.amount ?? 0), sub: `dont ${formatPrice(paidMonth._sum.amount ?? 0)} déjà versés` },
    { label: "En attente de versement", value: formatPrice(pending._sum.amount ?? 0), sub: member?.walletNumber ? "versé automatiquement" : "indiquez votre wallet" },
  ];

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Mes gains en direct</h2>
        <LiveRefresh />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-cream px-4 py-3">
            <p className="text-sm text-navy/80">{t.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-ink sm:text-2xl">{t.value}</p>
            <p className="text-sm text-navy/75">{t.sub}</p>
          </div>
        ))}
      </div>
      {!member?.walletNumber && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Indiquez votre numéro Wave ou Orange Money pour recevoir vos commissions automatiquement :{" "}
          <Link href="/admin/mon-profil#wallet" className="font-semibold underline">Mon wallet</Link>.
        </p>
      )}
      <h3 className="mt-6 text-base font-semibold text-ink">Dernières opérations</h3>
      {feed.length === 0 ? (
        <p className="mt-2 text-sm text-navy/75">Vos commissions apparaîtront ici dès qu&apos;une vente est payée.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {feed.map((f) => (
            <li key={f.key} className="flex items-start justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[15px] text-ink">{f.title}</p>
                <p className="text-sm text-navy/75">{f.at.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {f.detail}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[15px] font-semibold ${f.tone}`}>{f.amount}</p>
                <p className="text-sm text-navy/75">{f.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
