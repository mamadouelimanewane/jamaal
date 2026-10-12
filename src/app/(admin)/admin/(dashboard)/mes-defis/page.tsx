import Link from "next/link";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";
import { prisma } from "@/lib/prisma";
import { challengeStandings } from "@/lib/challenges";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes défis" };

const fmt = (n: number, m: string) => (m === "CA" ? `${n.toLocaleString("fr-FR")} FCFA` : `${n} vente${n > 1 ? "s" : ""}`);

export default async function MyChallengesPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const now = new Date();
  const challenges = await prisma.challenge.findMany({ where: { active: true, endsAt: { gte: new Date(now.getTime() - 31 * 86_400_000) } }, orderBy: { endsAt: "asc" } });
  const rows = await Promise.all(challenges.map(async (c) => ({ c, s: await challengeStandings(c) })));
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes défis 🏆</h1>
        <p className="mt-1 text-sm text-navy/75">Atteignez l&apos;objectif avant la date de fin : le bonus arrive tout seul sur votre wallet. Le classement se met à jour à chaque vente.</p>
      </div>
      {rows.map(({ c, s }) => {
        const mine = s.find((r) => r.consultantId === me.id);
        const value = mine?.value ?? 0;
        const pct = Math.min(100, Math.round((value / c.target) * 100));
        const place = s.findIndex((r) => r.consultantId === me.id);
        const daysLeft = Math.max(0, Math.ceil((c.endsAt.getTime() - now.getTime()) / 86_400_000));
        return (
          <article key={c.id} className="rounded-2xl border border-ia/25 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy">{c.title}</p>
                <p className="text-xs text-navy/70">
                  Objectif {fmt(c.target, c.metric)} · bonus <strong>{c.bonus.toLocaleString("fr-FR")} FCFA</strong> ·{" "}
                  {c.startsAt > now ? `commence le ${c.startsAt.toLocaleDateString("fr-FR")}` : c.endsAt < now ? "terminé" : `${daysLeft} jour(s) restant(s)`}
                </p>
              </div>
              {mine?.reached && <span className="rounded-full bg-ia-light px-3 py-1 text-xs font-semibold text-ia-dark">Objectif atteint ✅</span>}
            </div>
            {c.description && <p className="mt-2 text-sm text-navy/80">{c.description}</p>}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-navy/70">
                <span>Vous : {fmt(value, c.metric)}</span>
                <span>{mine?.reached ? "Bravo !" : `Reste ${fmt(Math.max(0, c.target - value), c.metric)}`}</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-ia-light">
                <div className="h-full rounded-full bg-ia transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <ol className="mt-4 space-y-1 text-sm">
              {s.slice(0, 5).map((r, i) => (
                <li key={r.consultantId} className={`flex justify-between rounded-lg px-2 py-1 ${r.consultantId === me.id ? "bg-ia-light/60 font-semibold" : ""}`}>
                  <span className="text-navy">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {r.consultantId === me.id ? "Vous" : r.name.split(/\s+/)[0]}</span>
                  <span className="text-navy/75">{fmt(r.value, c.metric)}</span>
                </li>
              ))}
              {place >= 5 && <li className="flex justify-between rounded-lg bg-ia-light/60 px-2 py-1 font-semibold"><span>{place + 1}. Vous</span><span>{fmt(value, c.metric)}</span></li>}
              {!s.length && <li className="text-navy/60">Personne n&apos;a encore vendu : soyez le premier !</li>}
            </ol>
          </article>
        );
      })}
      {!rows.length && <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-navy/70">Pas de défi en cours. Revenez bientôt !</p>}
      <p className="text-sm text-navy/70">
        Pour progresser : <Link href="/admin/formation" className="font-semibold text-ia-dark underline">Formation et quiz</Link> · <Link href="/admin/mon-marketing" className="font-semibold text-ia-dark underline">Visuels à partager</Link>
      </p>
    </div>
  );
}
