import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { allShopsStats } from "@/lib/shop/shop-stats-store";
import { parsePeriod, rate, STAT_PERIODS } from "@/lib/shop/shop-stats";
import { getShopTheme } from "@/lib/shop/themes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statistiques des boutiques" };

const F = (n: number) => n.toLocaleString("fr-FR");

/** Toutes les boutiques des revendeurs (/c/<slug>) : visites, clics, commandes en ligne, thème choisi. */
export default async function AllShopsStatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdminPage("revendeurs");
  const days = parsePeriod((await searchParams).p);
  const { rows, totals } = await allShopsStats(days);
  const themes = new Map<string, number>();
  for (const r of rows) {
    const name = getShopTheme(r.theme).name;
    themes.set(name, (themes.get(name) ?? 0) + 1);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Statistiques des boutiques</h1>
        <p className="mt-1 text-sm text-navy/75">Ce que rapportent les boutiques personnelles des revendeurs (lien de bio) : visiteurs, clics vers WhatsApp et vers les parfums, commandes passées en ligne avec leur lien.</p>
      </div>
      <nav aria-label="Période" className="flex flex-wrap gap-2">
        {STAT_PERIODS.map((p) => (
          <Link key={p} href={`?p=${p}`} aria-current={p === days ? "page" : undefined} className={`min-h-10 rounded-full border px-4 py-2 text-sm font-medium ${p === days ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:bg-cream"}`}>{p} jours</Link>
        ))}
      </nav>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Boutiques visitées", `${F(totals.active)} / ${F(rows.length)}`],
          ["Visiteurs", F(totals.visitors)],
          ["Clics WhatsApp", `${F(totals.whatsapp)} · ${rate(totals.whatsapp, totals.visitors)} %`],
          ["Commandes en ligne", F(totals.orders)],
          ["Chiffre d'affaires", `${F(totals.amount)} F`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">{l}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-navy">{v}</p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-navy">Par boutique</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-navy/60">
              <tr><th className="py-2 pr-3">Revendeur</th><th className="py-2 pr-3">Thème</th><th className="py-2 pr-3 text-right">Visiteurs</th><th className="py-2 pr-3 text-right">WhatsApp</th><th className="py-2 pr-3 text-right">Produits</th><th className="py-2 pr-3 text-right">Commandes</th><th className="py-2 text-right">CA</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-3">
                    <a href={`/c/${r.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline">{r.name}</a>
                    <span className="block text-xs text-navy/60">{r.city}{r.ready ? "" : " · boutique à compléter (photo, coups de cœur)"}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-navy/80">{getShopTheme(r.theme).name}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-navy">{F(r.visitors)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-navy">{F(r.whatsapp)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-navy">{F(r.products)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-navy">{F(r.orders)}</td>
                  <td className="py-2.5 text-right tabular-nums text-navy">{F(r.amount)} F</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-navy">Thèmes choisis</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[...themes.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => (
            <li key={n} className="rounded-full border border-line bg-cream/50 px-3 py-1.5 text-sm text-navy">{n} · <strong>{c}</strong></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
