import Link from "next/link";
import { Split } from "lucide-react";
import { dispatchScenarios, payoutChannels, type BusinessModel, type Scenario } from "@/lib/business-model";

const EXAMPLE = 10_000;
const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;

/**
 * Répartition automatique des commissions : pour chaque cas de vente, la part de chaque acteur (vendeur,
 * Parrain, Leader), créditée directement sur son wallet JAMAAL, puis retirable vers Wave ou Orange Money.
 */
export function CommissionDispatch({ model, highlight, admin = false }: { model: BusinessModel; highlight?: Scenario | null; admin?: boolean }) {
  const rows = dispatchScenarios(model);
  const channels = payoutChannels(model).map((c) => (c === "WAVE" ? "Wave" : "Orange Money")).join(" ou ");
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Split size={18} /> Répartition de chaque vente</h2>
          <p className="mt-1 text-sm text-navy/75">
            Dès qu&apos;une vente est {model.payoutTrigger === "DELIVERED" ? "livrée" : "payée"}, chaque part est créditée automatiquement sur le wallet JAMAAL
            de son bénéficiaire, qui la retire quand il veut vers {channels}. Exemple pour {f(EXAMPLE)} de produits (hors livraison).
          </p>
        </div>
        {admin && <Link href="/admin/modele-economique" className="rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-navy hover:bg-cream">Modifier les taux →</Link>}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className={`rounded-xl border p-4 ${highlight === r.id ? "border-emerald-400 bg-emerald-50/60" : "border-line"}`}>
            <p className="text-sm font-semibold text-navy">{r.label}{highlight === r.id && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">vos ventes</span>}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {r.parts.map((p) => (
                <li key={p.actor} className="flex items-center justify-between gap-3">
                  <span className="text-navy/85">{p.actor}</span>
                  <span className="tabular-nums text-navy"><strong>{p.pct} %</strong> <span className="text-navy/60">· {f((EXAMPLE * p.pct) / 100)}</span></span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 border-t border-line pt-1 text-xs text-navy/70">
                <span>Total des commissions</span>
                <span className="tabular-nums">{r.total} % · {f((EXAMPLE * r.total) / 100)}</span>
              </li>
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
