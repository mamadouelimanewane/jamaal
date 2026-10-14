import Link from "next/link";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";
import { getConsultantRankings, getMonthlyLeaderboard, getProgressToNextRank, RANK_LABELS } from "@/lib/ranking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon classement" };

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const badge = { GOLD: "🥇 Gold", SILVER: "🥈 Silver", BRONZE: "🥉 Bronze" } as const;

export default async function MyRankingPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;

  const [all, top] = await Promise.all([getConsultantRankings(), getMonthlyLeaderboard(10)]);
  const mine = all.find((r) => r.consultantId === me.id) ?? { consultantId: me.id, monthlyRevenue: 0, activeSponsoredCount: 0, rank: null };
  const progress = getProgressToNextRank(mine);
  const sorted = all.filter((r) => r.monthlyRevenue > 0).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  const place = sorted.findIndex((r) => r.consultantId === me.id);
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon classement 🏅</h1>
        <p className="mt-1 text-sm text-navy/75">Classement des revendeurs pour {month}, d&apos;après le chiffre d&apos;affaires net des remboursements.</p>
      </div>

      <section className="rounded-2xl border border-ia/25 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-navy/60">Votre rang</p>
            <p className="text-xl font-semibold text-navy">{mine.rank ? badge[mine.rank] : "Pas encore de rang"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-navy/60">Votre place</p>
            <p className="text-xl font-semibold text-navy">{place >= 0 ? `${place + 1}ᵉ sur ${sorted.length}` : "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-navy/60">Ce mois-ci</p>
            <p className="text-xl font-semibold text-navy">{fcfa(mine.monthlyRevenue)}</p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-ia-light/60 px-3 py-2 text-sm text-navy">
          {progress.nextRank
            ? `Pour passer ${RANK_LABELS[progress.nextRank]} : encore ${fcfa(progress.revenueNeeded)} de ventes, ou ${progress.sponsoredNeeded} filleul(s) actif(s) de plus.`
            : "Vous êtes au sommet ce mois-ci. Bravo ! 🎉"}
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-semibold text-navy">Top 10 du mois</h2>
        <ol className="space-y-1 text-sm">
          {top.map((r, i) => (
            <li key={r.consultantId} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${r.consultantId === me.id ? "bg-ia-light/60 font-semibold" : ""}`}>
              <span className="text-navy">
                {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {r.consultantId === me.id ? "Vous" : r.name.split(/\s+/)[0]}
                {r.city ? <span className="text-navy/60"> · {r.city}</span> : null}
              </span>
              <span className="text-navy/75">{r.rank ? RANK_LABELS[r.rank] : ""} · {fcfa(r.monthlyRevenue)}</span>
            </li>
          ))}
          {!top.length && <li className="text-navy/60">Personne n&apos;a encore vendu ce mois-ci : soyez le premier !</li>}
        </ol>
      </section>

      <p className="text-sm text-navy/70">
        Pour progresser : <Link href="/admin/mon-marketing" className="font-semibold text-ia-dark underline">visuels à partager</Link> · <Link href="/admin/mes-defis" className="font-semibold text-ia-dark underline">défis en cours</Link>
      </p>
    </div>
  );
}
