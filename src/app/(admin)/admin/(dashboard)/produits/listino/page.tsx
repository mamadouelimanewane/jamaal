import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { loadListinoPlan } from "@/lib/listino-db";
import { LISTINO } from "@/lib/listino";
import { formatPrice } from "@/lib/currency";
import { ApplyListinoButton } from "@/components/admin/ApplyListinoButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Listino Chogan" };

export default async function ListinoPage() {
  await requireAdminPage("catalogue");
  const plan = await loadListinoPlan();
  const shown = plan.items.slice(0, 80);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/produits" className="text-xs text-navy/70 hover:underline">← Produits</Link>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Listino Chogan</h1>
        <p className="mt-1 max-w-3xl text-sm text-navy/75">
          {LISTINO.edition}. Comparaison de la liste de prix officielle avec le catalogue du site. Prix de vente d&apos;un format = prix Chogan en euros × 655,957 × 1,25, arrondi à la centaine.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs uppercase text-navy/60">Références du listing</p><p className="text-2xl font-semibold text-navy">{plan.total}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs uppercase text-navy/60">Complètes</p><p className="text-2xl font-semibold text-emerald-700">{plan.complete}</p></div>
        <div className={`rounded-2xl border p-4 ${plan.formatsToAdd ? "border-amber-300 bg-amber-50" : "border-line bg-white"}`}><p className="text-xs uppercase text-navy/60">Formats manquants</p><p className="text-2xl font-semibold text-navy">{plan.formatsToAdd}</p><p className="text-xs text-navy/65">sur {plan.items.length} produits</p></div>
        <div className={`rounded-2xl border p-4 ${plan.priceDiffs.length ? "border-rose-300 bg-rose-50" : "border-line bg-white"}`}><p className="text-xs uppercase text-navy/60">Écarts de prix</p><p className="text-2xl font-semibold text-navy">{plan.priceDiffs.length}</p></div>
      </div>

      <ApplyListinoButton formats={plan.formatsToAdd} products={plan.items.length} />

      {plan.priceDiffs.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Écarts de prix (à examiner, non modifiés automatiquement)</h2>
          <ul className="space-y-1 text-sm">
            {plan.priceDiffs.map((d) => (
              <li key={d.productId + d.format} className="rounded-lg border border-rose-200 bg-white px-3 py-2">
                <Link href={`/admin/produits/${d.productId}/modifier`} className="font-medium text-navy underline">{d.name}</Link> · {d.code} · {d.format} : site {formatPrice(d.site)}, listing {formatPrice(d.expected)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.notFound.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Références du listing sans produit sur le site</h2>
          <p className="text-sm text-navy/75">{plan.notFound.join(", ")}</p>
        </section>
      )}

      {plan.singleFormat.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Produits à format unique (à traiter à la main)</h2>
          <p className="text-sm text-navy/75">{plan.singleFormat.map((s) => `${s.code} ${s.name}`).join(" · ")}</p>
        </section>
      )}

      {shown.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Formats qui seront ajoutés</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Formats ajoutés</th></tr></thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.productId} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-xs">{i.code}</td>
                    <td className="px-3 py-2 text-navy">{i.name}</td>
                    <td className="px-3 py-2 text-xs text-navy/80">{i.add.map((f) => `${f.label} · ${formatPrice(f.price)} (${f.code})`).join("  —  ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.items.length > shown.length && <p className="mt-2 text-xs text-navy/65">… et {plan.items.length - shown.length} autres produits.</p>}
        </section>
      )}

      <p className="text-xs text-navy/60">Pour un nouveau listing : <code>node scripts/pdf-listino.cjs « fichier.pdf »</code> régénère <code>src/data/chogan-listino.json</code>, puis cette page montre les écarts.</p>
    </div>
  );
}
