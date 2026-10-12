import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { deleteChallenge, saveChallenge } from "@/lib/actions/growth";
import { challengeStandings, METRIC_LABELS, type ChallengeMetric } from "@/lib/challenges";

export const dynamic = "force-dynamic";
export const metadata = { title: "Défis du mois" };

const day = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const fmt = (n: number, m: string) => (m === "CA" ? `${n.toLocaleString("fr-FR")} FCFA` : `${n} vente${n > 1 ? "s" : ""}`);

export default async function ChallengesAdminPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireAdminPage();
  const { edit } = await searchParams;
  const challenges = await prisma.challenge.findMany({ orderBy: [{ endsAt: "desc" }], take: 30 });
  const current = edit ? challenges.find((c) => c.id === edit) : null;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const standings = await Promise.all(challenges.slice(0, 6).map((c) => challengeStandings(c)));
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-ia">Réseau</p>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Défis du mois</h1>
        <p className="mt-1 text-sm text-navy/75">Un objectif (nombre de ventes ou chiffre d&apos;affaires encaissé) et un bonus. Les revendeurs voient le classement en direct dans « Mes défis ». À la fin du défi, chaque revendeur qui a atteint l&apos;objectif reçoit le bonus sur son wallet, automatiquement (tâche du soir).</p>
      </div>

      <form action={saveChallenge} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        <h2 className="font-semibold text-navy sm:col-span-2">{current ? `Modifier « ${current.title} »` : "Nouveau défi"}</h2>
        {current && <input type="hidden" name="id" value={current.id} />}
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Titre
          <input name="title" required minLength={3} maxLength={120} defaultValue={current?.title ?? ""} placeholder="10 ventes en octobre = 10 000 FCFA" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Mesure
          <select name="metric" defaultValue={current?.metric ?? "VENTES"} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
            <option value="VENTES">Nombre de ventes</option>
            <option value="CA">Chiffre d&apos;affaires encaissé (FCFA)</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Objectif
          <input name="target" type="number" required min={1} defaultValue={current?.target ?? 10} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Bonus versé au wallet (FCFA)
          <input name="bonus" type="number" required min={0} defaultValue={current?.bonus ?? 10000} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <div />
        <label className="text-xs font-semibold text-navy/85">
          Début
          <input name="startsAt" type="date" required defaultValue={day(current?.startsAt) || day(monthStart)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Fin (incluse)
          <input name="endsAt" type="date" required defaultValue={day(current?.endsAt) || day(monthEnd)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Message aux revendeurs
          <textarea name="description" rows={2} maxLength={1000} defaultValue={current?.description ?? ""} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-navy/85 sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={current ? current.active : true} /> Défi actif
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button className="rounded-full bg-ia px-5 py-2.5 text-sm font-semibold text-white hover:bg-ia-dark">{current ? "Enregistrer" : "Lancer le défi"}</button>
          {current && <Link href="/admin/defis" className="rounded-full border border-line px-5 py-2.5 text-sm">Annuler</Link>}
        </div>
      </form>

      {challenges.map((c, idx) => {
        const s = standings[idx];
        const status = c.awardedAt ? "Clôturé, bonus versés" : !c.active ? "Inactif" : c.endsAt < now ? "Terminé (versement ce soir)" : c.startsAt > now ? "À venir" : "En cours";
        return (
          <article key={c.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-navy">{c.title}</p>
                <p className="text-xs text-navy/70">
                  Objectif {fmt(c.target, c.metric)} · bonus {c.bonus.toLocaleString("fr-FR")} FCFA · du {c.startsAt.toLocaleDateString("fr-FR")} au {c.endsAt.toLocaleDateString("fr-FR")} · {status}
                </p>
              </div>
              {!c.awardedAt && (
                <div className="flex gap-3 text-xs font-semibold">
                  <Link href={`/admin/defis?edit=${c.id}`} className="text-navy hover:underline">Modifier</Link>
                  <form action={deleteChallenge.bind(null, c.id)}>
                    <button className="text-rose-dark hover:underline">Supprimer</button>
                  </form>
                </div>
              )}
            </div>
            {s && (
              <ol className="mt-3 space-y-1 text-sm">
                {s.slice(0, 10).map((r, i) => (
                  <li key={r.consultantId} className="flex justify-between gap-3">
                    <span className="text-navy">{i + 1}. {r.name} <span className="text-navy/55">({r.city})</span></span>
                    <span className={r.reached ? "font-semibold text-ia-dark" : "text-navy/70"}>{fmt(r.value, c.metric)}{r.reached ? " ✅" : ""}</span>
                  </li>
                ))}
                {!s.length && <li className="text-navy/60">Aucune vente comptée pour l&apos;instant.</li>}
              </ol>
            )}
          </article>
        );
      })}
      <p className="text-xs text-navy/60">Mesure « {METRIC_LABELS[("VENTES" as ChallengeMetric)]} » : commandes non annulées, payées ou livrées, passées pendant le défi.</p>
    </div>
  );
}
