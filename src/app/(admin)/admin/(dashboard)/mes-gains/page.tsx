import { Banknote, Gift, Target, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getConsultantCommission } from "@/lib/commission";
import { getReseller, MONTHS_FR, startOfMonth } from "@/lib/reseller";
import { StatCard } from "@/components/admin/StatCard";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

export default async function MesGainsPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const now = new Date();

  const info = await getConsultantCommission(me.id);
  const l1 = await prisma.consultant.findMany({ where: { sponsorId: me.id }, select: { id: true } });
  const l1Ids = l1.map((c) => c.id);
  const l2 = l1Ids.length ? await prisma.consultant.findMany({ where: { sponsorId: { in: l1Ids } }, select: { id: true } }) : [];
  const l2Ids = l2.map((c) => c.id);

  const from = startOfMonth(-5);
  const [orders, payments, bonuses, target] = await Promise.all([
    prisma.order.findMany({
      where: { consultantId: { in: [me.id, ...l1Ids, ...l2Ids] }, status: { not: "ANNULEE" }, createdAt: { gte: from } },
      select: { consultantId: true, total: true, createdAt: true },
    }),
    prisma.commissionPayment.findMany({ where: { consultantId: me.id }, orderBy: { paidAt: "desc" }, take: 50 }),
    prisma.fastStartBonus.findMany({ where: { sponsorId: me.id }, include: { sponsoree: { select: { name: true } } } }),
    prisma.monthlyTarget.findUnique({ where: { consultantId_year_month: { consultantId: me.id, year: now.getFullYear(), month: now.getMonth() + 1 } } }),
  ]);

  const set1 = new Set(l1Ids);
  const set2 = new Set(l2Ids);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(-i);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`, own: 0, team1: 0, team2: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const o of orders) {
    const mo = byKey.get(`${o.createdAt.getFullYear()}-${o.createdAt.getMonth()}`);
    if (!mo || !o.consultantId) continue;
    if (o.consultantId === me.id) mo.own += o.total;
    else if (set1.has(o.consultantId)) mo.team1 += o.total;
    else if (set2.has(o.consultantId)) mo.team2 += o.total;
  }
  const gain = (m: (typeof months)[number]) =>
    Math.round((m.own * info.rate) / 100) + Math.round((m.team1 * info.sponsorRate) / 100) + Math.round((m.team2 * info.sponsorL2Rate) / 100);

  const lifetimeTotal = info.lifetimeCommission + info.lifetimeSponsorCommission + info.lifetimeL2Commission;
  const monthTotal = info.monthlyCommission + info.monthlySponsorCommission + info.monthlyL2Commission;
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, lifetimeTotal - paid);
  const bonusPaid = bonuses.filter((b) => b.status !== "PENDING").reduce((s, b) => s + b.amount, 0);
  const progress = target ? Math.min(100, Math.round((info.monthlyRevenue / target.targetRevenue) * 100)) : null;

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes gains</h1>
      <p className="mt-1 text-sm text-navy/60">
        Vos commissions : {info.rate} % sur vos ventes, {info.sponsorRate} % sur celles de vos filleuls directs, {info.sponsorL2Rate} % sur le niveau 2.
        Les ventes annulées et remboursées ne comptent pas.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gains de ce mois" value={formatPrice(monthTotal)} icon={Banknote} color="emerald" />
        <StatCard label="Gains cumulés" value={formatPrice(lifetimeTotal)} icon={Wallet} color="navy" />
        <StatCard label="Déjà versé" value={formatPrice(paid)} icon={Banknote} color="blue" />
        <StatCard label="Solde à recevoir" value={formatPrice(balance)} icon={Wallet} color="rose" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Ce mois-ci en détail</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            <li className="flex justify-between py-2"><span className="text-navy/70">Mes ventes ({formatPrice(info.monthlyRevenue)})</span><span className="font-semibold">{formatPrice(info.monthlyCommission)}</span></li>
            <li className="flex justify-between py-2"><span className="text-navy/70">Équipe niveau 1 ({formatPrice(info.monthlyTeamRevenue)})</span><span className="font-semibold">{formatPrice(info.monthlySponsorCommission)}</span></li>
            <li className="flex justify-between py-2"><span className="text-navy/70">Équipe niveau 2 ({formatPrice(info.monthlyL2Revenue)})</span><span className="font-semibold">{formatPrice(info.monthlyL2Commission)}</span></li>
            <li className="flex justify-between py-2 text-navy"><span className="font-semibold">Total</span><span className="font-semibold text-emerald-700">{formatPrice(monthTotal)}</span></li>
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Target size={18} /> Objectif du mois</h2>
          {target ? (
            <>
              <p className="mt-3 text-sm text-navy/70">
                {formatPrice(info.monthlyRevenue)} vendus sur {formatPrice(target.targetRevenue)} d&apos;objectif.
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-navy/10">
                <div className="h-full rounded-full bg-rose-dark" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-navy/60">{progress} % atteint</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-navy/60">Aucun objectif fixé pour ce mois. L&apos;équipe JAMAAL peut vous en définir un.</p>
          )}
          {bonuses.length > 0 && (
            <p className="mt-4 flex items-center gap-2 text-xs text-navy/60"><Gift size={14} /> Bonus de démarrage rapide versés : <strong className="text-navy">{formatPrice(bonusPaid)}</strong></p>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Mois</th>
              <th className="px-4 py-3 text-right">Mes ventes</th>
              <th className="px-4 py-3 text-right">Équipe niv. 1</th>
              <th className="px-4 py-3 text-right">Équipe niv. 2</th>
              <th className="px-4 py-3 text-right">Gain</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <td className="px-4 py-3 capitalize">{m.label}</td>
                <td className="px-4 py-3 text-right">{formatPrice(m.own)}</td>
                <td className="px-4 py-3 text-right">{formatPrice(m.team1)}</td>
                <td className="px-4 py-3 text-right">{formatPrice(m.team2)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatPrice(gain(m))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Versements reçus</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-navy">{p.periodLabel}{p.note ? <span className="ml-2 text-xs text-navy/50">· {p.note}</span> : null}</span>
              <span className="font-semibold text-navy">{formatPrice(p.amount)} <span className="ml-2 text-xs font-normal text-navy/50">{p.paidAt.toLocaleDateString("fr-FR")}</span></span>
            </li>
          ))}
          {payments.length === 0 && <li className="py-4 text-center text-navy/50">Aucun versement pour le moment.</li>}
        </ul>
      </div>
    </div>
  );
}
