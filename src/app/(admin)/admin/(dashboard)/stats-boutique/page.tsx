import Link from "next/link";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";
import { shopStats } from "@/lib/shop/shop-stats-store";
import { parsePeriod, rate, STAT_PERIODS, trend } from "@/lib/shop/shop-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statistiques de ma boutique" };

const F = (n: number) => n.toLocaleString("fr-FR");
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function Trend({ now, before }: { now: number; before: number }) {
  const t = trend(now, before);
  if (t === null) return <span className="text-xs text-navy/55">nouvelle période</span>;
  const up = t >= 0;
  return <span className={`text-xs font-semibold ${up ? "text-emerald-800" : "text-rose-dark"}`}>{up ? "▲" : "▼"} {Math.abs(t)} % vs période précédente</span>;
}

/** Statistiques de la boutique personnelle (/c/<slug>) : visites, clics WhatsApp et produits, commandes en ligne. */
export default async function ShopStatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const days = parsePeriod((await searchParams).p);
  const s = await shopStats(me.id, days);
  const max = Math.max(1, ...s.series.map((d) => d.visitors));
  const tiles = [
    { label: "Visiteurs", value: F(s.visitors), sub: <Trend now={s.visitors} before={s.previous.visitors} /> },
    { label: "Clics WhatsApp", value: F(s.whatsapp), sub: <span className="text-xs text-navy/65">{rate(s.whatsapp, s.visitors)} % des visiteurs</span> },
    { label: "Clics sur un produit", value: F(s.products), sub: <span className="text-xs text-navy/65">{rate(s.products, s.visitors)} % des visiteurs</span> },
    { label: "Commandes en ligne", value: F(s.orders.count), sub: <span className="text-xs text-navy/65">{F(s.orders.amount)} FCFA</span> },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Statistiques de ma boutique</h1>
        <p className="mt-1 text-sm text-navy/75">
          Ce que donne votre lien de bio : visiteurs de votre boutique, clics vers WhatsApp et vers vos parfums, commandes passées en ligne avec votre lien. Vos propres visites ne sont pas comptées.
        </p>
      </div>

      <nav aria-label="Période" className="flex flex-wrap gap-2">
        {STAT_PERIODS.map((p) => (
          <Link key={p} href={`?p=${p}`} aria-current={p === days ? "page" : undefined} className={`min-h-10 rounded-full border px-4 py-2 text-sm font-medium ${p === days ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:bg-cream"}`}>
            {p} jours
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{t.value}</p>
            <div className="mt-1">{t.sub}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-navy">Visiteurs par jour</h2>
        {s.visitors === 0 ? (
          <p className="mt-3 text-sm text-navy/70">Aucune visite sur cette période. Partagez votre lien de bio (Ma boutique) sur Instagram, TikTok et votre statut WhatsApp.</p>
        ) : (
          <>
            <div className="mt-4 flex h-40 items-end gap-[2px]" role="img" aria-label={`Visiteurs par jour sur ${days} jours, au plus ${max} par jour`}>
              {s.series.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 items-end">
                  <div className="w-full rounded-t bg-navy/80 group-hover:bg-rose-dark" style={{ height: `${d.visitors ? Math.max(4, (d.visitors / max) * 100) : 0}%` }} title={`${dayLabel(d.day)} : ${d.visitors} visiteur${d.visitors > 1 ? "s" : ""}, ${d.whatsapp} clic${d.whatsapp > 1 ? "s" : ""} WhatsApp`} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-navy/60">
              <span>{dayLabel(s.series[0].day)}</span>
              <span>max. {max} / jour</span>
              <span>{dayLabel(s.series[s.series.length - 1].day)}</span>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-navy">Parfums les plus regardés</h2>
        {s.top.length ? (
          <ol className="mt-3 divide-y divide-line">
            {s.top.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-navy"><span className="mr-2 text-navy/50">{i + 1}.</span>{p.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-navy">{F(p.clicks)} clic{p.clicks > 1 ? "s" : ""}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-navy/70">Pas encore de clic sur un parfum. Choisissez vos coups de cœur dans Ma boutique pour guider vos visiteurs.</p>
        )}
      </section>

      <p className="text-xs text-navy/60">
        Comptage anonyme : un visiteur est compté une fois par visite (30 minutes). Les robots et aperçus de liens sont ignorés. Les commandes en ligne comptent celles passées sur le site avec votre lien, hors annulées.{" "}
        <Link href="/admin/ma-boutique" className="font-semibold text-navy underline">Personnaliser ma boutique</Link>
      </p>
    </div>
  );
}
