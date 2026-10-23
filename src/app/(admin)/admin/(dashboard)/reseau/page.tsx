import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { networkHealth } from "@/lib/health/run";
import { DROP_DAYS } from "@/lib/health/network-health";
import { alertManagersNow } from "@/lib/actions/network-health";
import { RowAction } from "@/components/admin/RowAction";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const metadata = { title: "Santé du réseau" };

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)} %`);
const wa = (phone: string, text: string) => {
  let d = phone.replace(/\D/g, "").replace(/^00/, "");
  if (d.length === 9) d = `221${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
};

/** Santé du réseau : membres qui décrochent, meilleurs parrains, activation des nouveaux. */
export default async function ReseauPage() {
  await requireAdminPage("revendeurs");
  const h = await networkHealth();
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Santé du réseau</h1>
          <p className="mt-1 text-sm text-navy/75">Qui décroche, qui fait grandir son équipe, et si les nouveaux démarrent bien. Chaque lundi, les Leaders et parrains reçoivent sur WhatsApp la liste de leurs membres qui décrochent.</p>
        </div>
        <RowAction label="Alerter les Leaders maintenant" run={alertManagersNow} confirm="Envoyer maintenant à chaque Leader et parrain la liste de ses membres qui décrochent ?" />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Membres actifs (vente sur 30 j)", `${h.totals.active30} / ${h.totals.members} (${pct(h.totals.activeRate)})`],
          [`Décrochent (${DROP_DAYS} j sans vente)`, String(h.totals.droppers)],
          ["Activation des nouveaux", pct(h.activation.rate)],
          ["Nouveaux suivis", `${h.activation.activated} / ${h.activation.joined} activés`],
        ].map(([l, v]) => <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="text-xl font-semibold text-navy">{v}</p></div>)}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Membres qui décrochent</h2>
        <p className="mt-1 text-sm text-navy/70">Aucune vente depuis {DROP_DAYS} jours, ou pas encore de première vente {DROP_DAYS} jours après l&apos;inscription.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Membre</th><th className="px-3 py-2">Situation</th><th className="px-3 py-2">Parrain</th><th className="px-3 py-2">Leader</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {h.droppers.map((d) => (
                <tr key={d.m.id} className="border-t border-line">
                  <td className="px-3 py-2"><Link href={`/admin/consultants/${d.m.id}`} className="font-semibold text-navy hover:underline">{d.m.name}</Link><p className="text-xs text-navy/60">{d.m.city}</p></td>
                  <td className={`px-3 py-2 ${d.idle >= 45 ? "font-semibold text-rose-dark" : "text-amber-800"}`}>{d.neverSold ? `Pas encore de vente (inscrit·e il y a ${d.idle} j)` : `Aucune vente depuis ${d.idle} j`}</td>
                  <td className="px-3 py-2 text-navy/80">{d.sponsor?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-navy/80">{d.leader?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right"><a href={wa(d.m.whatsapp, `Bonjour ${d.m.name.split(/\s+/)[0]}, c'est l'équipe JAMAAL 👋 Comment ça se passe ? On peut vous aider à relancer vos ventes : vos actions du jour sont prêtes dans votre espace (messages déjà rédigés).`)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white">WhatsApp</a></td>
                </tr>
              ))}
              {!h.droppers.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-navy/60">Personne ne décroche : bravo à toute l&apos;équipe 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Meilleurs parrains (30 jours)</h2>
          <ol className="mt-3 divide-y divide-line text-sm">
            {h.topSponsors.map((s, i) => (
              <li key={s.m.id} className="flex items-center justify-between gap-3 py-2">
                <span><span className="mr-2 font-semibold text-navy/50">{i + 1}.</span><span className="font-semibold text-navy">{s.m.name}</span><span className="block pl-5 text-xs text-navy/60">{s.active} / {s.filleuls} filleul(s) actif(s){s.newcomers ? ` · ${s.activated}/${s.newcomers} nouveaux activés` : ""}</span></span>
                <span className="font-semibold text-navy">{formatPrice(s.teamRevenue)}</span>
              </li>
            ))}
            {!h.topSponsors.length && <li className="py-3 text-navy/60">Pas encore de filleuls.</li>}
          </ol>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Activation des nouveaux par mois d&apos;inscription</h2>
          <p className="mt-1 text-xs text-navy/60">Part des inscrits ayant fait leur première vente dans les 30 jours.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {h.activation.byMonth.map(([month, v]) => (
              <li key={month}>
                <div className="flex justify-between text-navy"><span>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span><span className="font-semibold">{v.activated} / {v.joined} · {pct(v.joined ? v.activated / v.joined : null)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${v.joined ? (v.activated / v.joined) * 100 : 0}%` }} /></div>
              </li>
            ))}
            {!h.activation.byMonth.length && <li className="text-navy/60">Pas encore de nouveaux à suivre (inscrits il y a 30 à 180 jours).</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
