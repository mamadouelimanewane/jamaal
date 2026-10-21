import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { unbanVisitor } from "@/lib/actions/bot-guard";
import { API_LIMITS, HUMAN_LIMITS } from "@/lib/bot-guard";
import { guardEnabled } from "@/lib/bot-guard-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protection anti-aspiration" };

const REASONS: Record<string, string> = {
  aspirateur: "Aspirateurs, scripts et robots de copie",
  "piège": "Lien piège suivi",
  banni: "Visiteurs bannis revenus",
  "cadence-minute": "Trop de pages en une minute",
  "cadence-hour": "Trop de pages en une heure",
  "cadence-day": "Trop de pages en une journée",
};

export default async function ProtectionPage() {
  await requireAdminPage();
  const now = new Date();
  const since = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  const [stats, bans] = await Promise.all([
    prisma.botBlockStat.findMany({ where: { day: { gte: since } } }).catch(() => []),
    prisma.botBan.findMany({ where: { until: { gt: now } }, orderBy: { updatedAt: "desc" }, take: 100 }).catch(() => []),
  ]);
  const today = now.toISOString().slice(0, 10);
  const byReason = new Map<string, { today: number; month: number }>();
  for (const s of stats) {
    const r = byReason.get(s.reason) ?? { today: 0, month: 0 };
    r.month += s.count;
    if (s.day === today) r.today += s.count;
    byReason.set(s.reason, r);
  }
  const total = [...byReason.values()].reduce((a, b) => ({ today: a.today + b.today, month: a.month + b.month }), { today: 0, month: 0 });
  const on = guardEnabled();

  return (
    <div className="max-w-5xl">
      <h1 className="flex items-center gap-2 font-serif-display text-2xl font-semibold text-navy"><ShieldCheck size={22} /> Protection anti-aspiration</h1>
      <p className="mt-1 text-sm text-navy/75">
        Un robot surveille chaque visite du site et bloque les copies automatiques : aspirateurs de sites, scripts, robots d&apos;IA,
        et visiteurs qui ouvrent trop de pages trop vite. Les clients, Google, WhatsApp et Facebook passent normalement.
      </p>

      <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${on ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
        {on ? "✅ Protection active." : "⚠️ Protection désactivée (variable BOT_GUARD=off dans Vercel)."}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-navy/70">Requêtes refusées aujourd&apos;hui</p>
          <p className="mt-1 font-serif-display text-3xl font-semibold text-navy">{total.today.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-navy/70">Sur 30 jours</p>
          <p className="mt-1 font-serif-display text-3xl font-semibold text-navy">{total.month.toLocaleString("fr-FR")}</p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Par motif</h2>
        {byReason.size === 0 ? (
          <p className="mt-2 text-sm text-navy/70">Aucune tentative bloquée pour l&apos;instant.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-navy/60"><th className="py-2">Motif</th><th className="py-2 text-right">Aujourd&apos;hui</th><th className="py-2 text-right">30 jours</th></tr></thead>
            <tbody>
              {[...byReason.entries()].sort((a, b) => b[1].month - a[1].month).map(([r, v]) => (
                <tr key={r} className="border-t border-line"><td className="py-2">{REASONS[r] ?? r}</td><td className="py-2 text-right">{v.today}</td><td className="py-2 text-right">{v.month}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Visiteurs bannis en ce moment ({bans.length})</h2>
        <p className="mt-1 text-sm text-navy/70">Un client bloqué par erreur ? Débloquez-le ici : il retrouve l&apos;accès tout de suite.</p>
        {bans.length === 0 ? (
          <p className="mt-2 text-sm text-navy/70">Personne n&apos;est banni.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-navy/60"><th className="py-2">Adresse</th><th className="py-2">Navigateur</th><th className="py-2">Motif</th><th className="py-2">Jusqu&apos;au</th><th /></tr></thead>
              <tbody>
                {bans.map((b) => (
                  <tr key={b.key} className="border-t border-line align-top">
                    <td className="py-2 font-mono text-xs">{b.ip}</td>
                    <td className="max-w-[260px] truncate py-2 text-xs text-navy/70" title={b.userAgent ?? ""}>{b.userAgent ?? "—"}</td>
                    <td className="py-2">{b.reason}{b.hits > 1 ? ` (${b.hits}×)` : ""}</td>
                    <td className="py-2 text-xs">{b.until.toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })}</td>
                    <td className="py-2 text-right">
                      <form action={unbanVisitor}><input type="hidden" name="key" value={b.key} /><button className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-navy hover:bg-cream">Débloquer</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-cream p-5 text-sm text-navy/85">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Comment ça marche</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b>Aspirateurs et scripts</b> (HTTrack, Wget, curl, Python, navigateurs sans écran…) et <b>robots d&apos;IA</b> (GPTBot, ClaudeBot, CCBot…) : refusés d&apos;office.</li>
          <li><b>Cadence</b> : au-delà de {HUMAN_LIMITS.perMinute} pages par minute, {HUMAN_LIMITS.perHour} par heure ou {HUMAN_LIMITS.perDay} par jour (images et recherches : {API_LIMITS.perMinute}/min), le visiteur est freiné ; au-delà de l&apos;heure ou du jour, il est banni.</li>
          <li><b>Lien piège</b> : un lien invisible pour les clients et interdit aux moteurs de recherche ; un aspirateur qui le suit est banni 24 h.</li>
          <li><b>Catalogue complet</b> (flux WhatsApp) : servi seulement au robot de Meta ou avec la clé CATALOG_FEED_TOKEN.</li>
          <li><b>Toujours autorisés</b> : clients, membres connectés, Google, Bing, aperçus WhatsApp, Facebook, Telegram, webhooks de paiement et de WhatsApp.</li>
          <li><b>En cas de souci</b> : la variable <code>BOT_GUARD=off</code> dans Vercel coupe la protection immédiatement (puis Redeploy).</li>
        </ul>
      </section>
    </div>
  );
}
