import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { buildForecast, purchaseOrderText } from "@/lib/forecast/run";
import { saveForecastSettings, forecastAiNote } from "@/lib/actions/forecast";
import { geminiConfigured } from "@/lib/ai/gemini";
import { formatPrice } from "@/lib/currency";
import { CopyButton } from "@/components/admin/CopyButton";
import { PrintButton } from "@/components/admin/PrintButton";
import { AiNote } from "@/components/admin/AiNote";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prévision de stock" };

/** Prévision des ventes (fêtes du Sénégal comprises) et bon de commande Chogan préparé automatiquement. */
export default async function PrevisionPage() {
  await requireAdminPage("stocks");
  const f = await buildForecast();
  const text = purchaseOrderText(f.toOrder);
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/stocks" className="text-xs text-navy/70 hover:underline">← Stocks</Link>
          <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Prévision et bon de commande</h1>
          <p className="mt-1 max-w-3xl text-sm text-navy/75">Ce qui va se vendre dans les {f.settings.leadWeeks + f.settings.coverWeeks} prochaines semaines (délai Chogan + couverture), fêtes comprises, et la commande qui en découle : ni rupture, ni argent qui dort en stock. L&apos;équipe reçoit le bon chaque semaine sur WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <CopyButton text={text} label="Copier le bon de commande" />
          <PrintButton />
        </div>
      </div>

      {f.events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.events.map((e) => (
            <span key={e.label + e.date.toISOString()} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-900 ring-1 ring-amber-200">
              🎉 <strong>{e.label}</strong> dans {e.weeks} sem. · ventes × {e.uplift.toLocaleString("fr-FR")}{e.learned ? " (appris sur vos ventes)" : " (estimation)"}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["À commander", `${f.totals.units} article(s)`],
          ["Coût estimé", formatPrice(f.totals.cost)],
          ["Ruptures sur produits vendus", String(f.totals.ruptures)],
          ["Stock dormant", formatPrice(f.totals.dormantValue)],
        ].map(([l, v]) => <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="text-xl font-semibold text-navy">{v}</p></div>)}
      </div>

      <form action={saveForecastSettings} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4 text-sm print:hidden">
        <label className="text-xs text-navy/70">Délai de livraison Chogan (semaines)<input name="leadWeeks" type="number" min={1} max={16} defaultValue={f.settings.leadWeeks} className="mt-1 block w-24 rounded-lg border border-line px-3 py-1.5 text-sm" /></label>
        <label className="text-xs text-navy/70">Couverture souhaitée (semaines)<input name="coverWeeks" type="number" min={1} max={16} defaultValue={f.settings.coverWeeks} className="mt-1 block w-24 rounded-lg border border-line px-3 py-1.5 text-sm" /></label>
        <button className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white">Recalculer</button>
        {geminiConfigured() && <div className="ml-auto"><AiNote run={forecastAiNote} /></div>}
      </form>

      <section>
        <h2 className="mb-2 font-serif-display text-lg font-semibold text-navy">Bon de commande proposé</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Rythme / sem.</th><th className="px-3 py-2">Prévu</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Réservé</th><th className="px-3 py-2">À commander</th><th className="px-3 py-2">Coût</th></tr></thead>
            <tbody>
              {f.toOrder.map((l) => (
                <tr key={l.key} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">{l.code ?? l.productCode ?? "—"}</td>
                  <td className="px-3 py-2 text-navy">{l.name} <span className="text-navy/55">· {l.format}</span>{l.event && <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">{l.event.label}</span>}</td>
                  <td className="px-3 py-2">{l.weekly.toLocaleString("fr-FR")}</td>
                  <td className="px-3 py-2">{Math.ceil(l.demand)}</td>
                  <td className={`px-3 py-2 ${l.stock <= 0 ? "font-semibold text-rose-dark" : ""}`}>{l.stock}</td>
                  <td className="px-3 py-2">{l.reserved || ""}</td>
                  <td className="px-3 py-2 font-semibold text-ia-dark">{l.order}</td>
                  <td className="px-3 py-2">{l.unitCost ? formatPrice(l.order * l.unitCost) : "—"}</td>
                </tr>
              ))}
              {!f.toOrder.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-navy/70">Rien à commander : le stock couvre les ventes prévues.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {f.dormant.length > 0 && (
        <section>
          <h2 className="font-serif-display text-lg font-semibold text-navy">Stock dormant ({formatPrice(f.totals.dormantValue)})</h2>
          <p className="mb-2 mt-1 text-sm text-navy/70">Plus de 16 semaines de ventes en stock : à écouler par une offre, un coffret ou le kit du matin des revendeurs.</p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Rythme / sem.</th><th className="px-3 py-2">Semaines de stock</th><th className="px-3 py-2">En trop</th><th className="px-3 py-2">Valeur</th></tr></thead>
              <tbody>
                {f.dormant.slice(0, 40).map((l) => (
                  <tr key={l.key} className="border-t border-line">
                    <td className="px-3 py-2 text-navy">{l.name} <span className="text-navy/55">· {l.format}</span></td>
                    <td className="px-3 py-2">{l.stock}</td>
                    <td className="px-3 py-2">{l.weekly.toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2">{l.weeksOfStock ?? "aucune vente"}</td>
                    <td className="px-3 py-2 font-semibold">{l.dormant}</td>
                    <td className="px-3 py-2">{formatPrice(l.dormant * (l.unitCost ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="text-xs text-navy/55 print:hidden">Méthode : rythme des 8 dernières semaines (hors fêtes), multiplié pendant les fêtes par l&apos;effet constaté l&apos;an dernier sur vos ventes (sinon une estimation), plus une semaine de sécurité et les réservations payées, moins le stock. Dates de Korité et Tabaski prévues à ± 1 jour.</p>
    </div>
  );
}
