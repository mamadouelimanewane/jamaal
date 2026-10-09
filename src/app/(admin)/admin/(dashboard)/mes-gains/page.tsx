import { Banknote, Gift, Target, Trophy, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getConsultantCommission, COMMISSIONABLE_ORDER, commissionBase } from "@/lib/commission";
import { getBusinessModel } from "@/lib/business-model-store";
import { primeStatus } from "@/lib/business-model";
import { getMemberTitle, recruitTitleFor } from "@/lib/network";
import { salesBetween } from "@/lib/team";
import Link from "next/link";
import { WALLET_LABELS } from "@/lib/payouts/providers";
import { LiveEarnings } from "@/components/admin/LiveEarnings";
import { getReseller, MONTHS_FR, startOfMonth } from "@/lib/reseller";
import { StatCard } from "@/components/admin/StatCard";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

export default async function MesGainsPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const now = new Date();

  const [info, model] = await Promise.all([getConsultantCommission(me.id), getBusinessModel()]);
  const prime = primeStatus(info.monthlyRevenue, model);
  const myTitle = await getMemberTitle(me.id);
  const [walletPending, walletPayouts] = await Promise.all([
    prisma.commissionEntry.aggregate({ where: { consultantId: me.id, status: "A_VERSER" }, _sum: { amount: true } }),
    prisma.payout.findMany({ where: { consultantId: me.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const level1 = `${recruitTitleFor(myTitle) ?? "filleul"}s`;
  const level2 = `filleuls de mes ${level1}`;
  const l1 = await prisma.consultant.findMany({ where: { sponsorId: me.id }, select: { id: true } });
  const l1Ids = l1.map((c) => c.id);
  const l2 = l1Ids.length ? await prisma.consultant.findMany({ where: { sponsorId: { in: l1Ids } }, select: { id: true } }) : [];
  const l2Ids = l2.map((c) => c.id);
  // Prime d'équipe du mois en cours (Leader : toute l'équipe ; Parrain : ses Consultants).
  const teamTiers = myTitle === "Leader" ? model.leaderTeamTiers : myTitle === "Parrain" ? model.parrainTeamTiers : [];
  const teamSalesMonth = model.teamPrimesEnabled && teamTiers.length ? await salesBetween(myTitle === "Leader" ? [...l1Ids, ...l2Ids] : l1Ids, startOfMonth(), startOfMonth(1)) : 0;
  const teamPrime = primeStatus(teamSalesMonth, model, teamTiers);

  const from = startOfMonth(-5);
  const [orders, payments, bonuses, target] = await Promise.all([
    prisma.order.findMany({
      where: { ...COMMISSIONABLE_ORDER, consultantId: { in: [me.id, ...l1Ids, ...l2Ids] }, createdAt: { gte: from } },
      select: { consultantId: true, total: true, deliveryFee: true, createdAt: true },
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
    const base = commissionBase(o);
    if (o.consultantId === me.id) mo.own += base;
    else if (set1.has(o.consultantId)) mo.team1 += base;
    else if (set2.has(o.consultantId)) mo.team2 += base;
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
      <p className="mt-1 text-sm text-navy/75">
        Vos commissions : {info.rate} % sur vos ventes, {info.sponsorRate} % sur celles de vos {level1}, {info.sponsorL2Rate} % sur celles des {level2},
        calculées sur le prix des produits (hors livraison) des ventes encaissées. Les ventes annulées et remboursées ne comptent pas.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gains de ce mois" value={formatPrice(monthTotal)} icon={Banknote} color="emerald" />
        <StatCard label="Gains cumulés" value={formatPrice(lifetimeTotal)} icon={Wallet} color="navy" />
        <StatCard label="Déjà versé" value={formatPrice(paid)} icon={Banknote} color="blue" />
        <StatCard label="Solde à recevoir" value={formatPrice(balance)} icon={Wallet} color="rose" />
      </div>

      <div className="mt-6">
        <LiveEarnings consultantId={me.id} />
      </div>

      <div className={`mt-6 rounded-2xl border p-5 ${me.walletNumber ? "border-line bg-white" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Wallet size={18} /> Mon wallet</h2>
          <Link href="/admin/mon-profil#wallet" className="text-sm font-semibold text-rose-dark hover:underline">{me.walletNumber ? "Modifier" : "Indiquer mon wallet"}</Link>
        </div>
        <p className="mt-2 text-[15px] text-navy/85">
          {me.walletNumber
            ? <>Vos commissions sont versées automatiquement sur <strong>{WALLET_LABELS[me.walletProvider as "WAVE"] ?? me.walletProvider} {me.walletNumber}</strong>.</>
            : <>Indiquez votre numéro Wave ou Orange Money pour recevoir vos commissions automatiquement.</>}
          {" "}En attente de versement : <strong>{formatPrice(walletPending._sum.amount ?? 0)}</strong>.
        </p>
        {walletPayouts.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {walletPayouts.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span className="text-navy/85">{p.createdAt.toLocaleDateString("fr-FR")} · {WALLET_LABELS[p.provider as "WAVE"] ?? p.provider}</span>
                <span className="font-semibold text-ink">{formatPrice(p.amount)} {p.status === "VERSE" ? "· versé" : p.status === "EN_COURS" ? "· en cours" : "· échec, nouvel essai prévu"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Ce mois-ci en détail</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            <li className="flex justify-between py-2"><span className="text-navy/85">Mes ventes ({formatPrice(info.monthlyRevenue)})</span><span className="font-semibold">{formatPrice(info.monthlyCommission)}</span></li>
            <li className="flex justify-between py-2"><span className="text-navy/85">Mes {level1} ({formatPrice(info.monthlyTeamRevenue)})</span><span className="font-semibold">{formatPrice(info.monthlySponsorCommission)}</span></li>
            <li className="flex justify-between py-2"><span className="text-navy/85">Les {level2} ({formatPrice(info.monthlyL2Revenue)})</span><span className="font-semibold">{formatPrice(info.monthlyL2Commission)}</span></li>
            <li className="flex justify-between py-2 text-navy"><span className="font-semibold">Total</span><span className="font-semibold text-emerald-700">{formatPrice(monthTotal)}</span></li>
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Target size={18} /> Objectif du mois</h2>
          {target ? (
            <>
              <p className="mt-3 text-sm text-navy/85">
                {formatPrice(info.monthlyRevenue)} vendus sur {formatPrice(target.targetRevenue)} d&apos;objectif.
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-navy/10">
                <div className="h-full rounded-full bg-rose-dark" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-navy/75">{progress} % atteint</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-navy/75">Aucun objectif fixé pour ce mois. L&apos;équipe JAMAAL peut vous en définir un.</p>
          )}
          {bonuses.length > 0 && (
            <p className="mt-4 flex items-center gap-2 text-xs text-navy/75"><Gift size={14} /> Bonus de démarrage rapide versés : <strong className="text-navy">{formatPrice(bonusPaid)}</strong></p>
          )}
        </div>
      </div>

      {model.primesEnabled && model.primeTiers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Trophy size={18} /> Primes du mois</h2>
          <p className="mt-1 text-sm text-navy/80">
            Ventes personnelles encaissées ce mois-ci : <strong className="text-navy">{formatPrice(info.monthlyRevenue)}</strong>.
            {prime.reached ? <> Palier atteint : prime de <strong className="text-emerald-700">{formatPrice(prime.reached.amount)}</strong>{prime.reached.extra ? ` + ${prime.reached.extra}` : ""}.</> : " Aucun palier atteint pour l'instant."}
          </p>
          {prime.next && (
            <>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-navy/10">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${prime.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-navy/75">
                Encore <strong className="text-navy">{formatPrice(prime.remaining)}</strong> pour la prime de {formatPrice(prime.next.amount)}{prime.next.extra ? ` + ${prime.next.extra}` : ""}.
              </p>
            </>
          )}
          <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {model.primeTiers.map((t) => (
              <li key={t.threshold} className={`rounded-xl border px-3 py-2 ${info.monthlyRevenue >= t.threshold ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line text-navy/85"}`}>
                <span className="block font-semibold">{formatPrice(t.threshold)} de ventes</span>
                Prime {formatPrice(t.amount)}{t.extra ? ` + ${t.extra}` : ""}
              </li>
            ))}
          </ul>
          {model.topSellerBonus > 0 && <p className="mt-3 text-xs text-navy/75">Bonus de {formatPrice(model.topSellerBonus)} pour le 1er du classement mensuel (chiffre d&apos;affaires client).</p>}
        </div>
      )}

      {model.teamPrimesEnabled && teamTiers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Trophy size={18} /> Prime d&apos;équipe du mois ({myTitle})</h2>
          <p className="mt-1 text-sm text-navy/80">
            Ventes encaissées de {myTitle === "Leader" ? "toute votre équipe (Parrains et leurs Consultants)" : "vos Consultants"} ce mois-ci : <strong className="text-navy">{formatPrice(teamSalesMonth)}</strong>.
            {teamPrime.reached ? <> Palier atteint : prime de <strong className="text-emerald-700">{formatPrice(teamPrime.reached.amount)}</strong>, versée à la clôture du mois.</> : " Aucun palier atteint pour l'instant."}
          </p>
          {teamPrime.next && (
            <>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-navy/10"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${teamPrime.progress}%` }} /></div>
              <p className="mt-2 text-xs text-navy/75">Encore <strong className="text-navy">{formatPrice(teamPrime.remaining)}</strong> pour la prime de {formatPrice(teamPrime.next.amount)}.</p>
            </>
          )}
          <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
            {teamTiers.map((t) => (
              <li key={t.threshold} className={`rounded-xl border px-3 py-2 ${teamSalesMonth >= t.threshold ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line text-navy/85"}`}>
                <span className="block font-semibold">{formatPrice(t.threshold)} de CA d&apos;équipe</span>
                Prime {formatPrice(t.amount)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Mois</th>
              <th className="px-4 py-3 text-right">Mes ventes</th>
              <th className="px-4 py-3 text-right">Mes {level1}</th>
              <th className="px-4 py-3 text-right">Leurs filleuls</th>
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
              <span className="text-navy">{p.periodLabel}{p.note ? <span className="ml-2 text-xs text-navy/70">· {p.note}</span> : null}</span>
              <span className="font-semibold text-navy">{formatPrice(p.amount)} <span className="ml-2 text-xs font-normal text-navy/70">{p.paidAt.toLocaleDateString("fr-FR")}</span></span>
            </li>
          ))}
          {payments.length === 0 && <li className="py-4 text-center text-navy/70">Aucun versement pour le moment.</li>}
        </ul>
      </div>
    </div>
  );
}
