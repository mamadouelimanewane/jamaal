import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { adjustStock } from "@/lib/actions/stock";

export const dynamic = "force-dynamic";

export default async function AdminStockPage() {
  await requireAdminPage();
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { variants: { orderBy: { volumeLabel: "asc" } } },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" }, take: 12,
      include: { product: { select: { name: true } }, variant: { select: { volumeLabel: true } }, user: { select: { name: true } } },
    }),
  ]);
  type StockRow = { product: (typeof products)[number]; variant: (typeof products)[number]["variants"][number] | null; stock: number; threshold: number };
  const rows = products.flatMap<StockRow>((product) => product.variants.length
    ? product.variants.map((variant) => ({ product, variant, stock: variant.stock, threshold: variant.lowStockThreshold }))
    : [{ product, variant: null, stock: product.stock, threshold: product.lowStockThreshold }]);
  const lowRows = rows.filter((row) => row.stock <= row.threshold);

  return <div className="space-y-8">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-dark">Inventaire JAMAAL</p>
      <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Stocks & réapprovisionnement</h1>
      <p className="mt-1 text-sm text-navy/60">Ajustez les quantités par parfum et format, avec un historique traçable.</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-navy">{products.length}</p><p className="text-xs text-navy/60">Références au catalogue</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-amber-700">{lowRows.length}</p><p className="text-xs text-navy/60">Formats sous le seuil</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-navy">{movements.length}</p><p className="text-xs text-navy/60">Derniers mouvements visibles</p></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4"><h2 className="font-semibold text-navy">État du stock</h2></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-cream text-left text-[10px] uppercase tracking-wider text-navy/50"><tr><th className="px-4 py-3">Parfum</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Disponible</th><th className="px-4 py-3">Seuil</th><th className="px-4 py-3">Ajustement</th></tr></thead>
        <tbody>{rows.map(({ product, variant, stock, threshold }) => <tr key={variant?.id ?? product.id} className="border-t border-line">
          <td className="px-4 py-3 font-medium text-navy">{product.name}</td>
          <td className="px-4 py-3 text-navy/65">{variant?.volumeLabel ?? "Format unique"}</td>
          <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stock <= threshold ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{stock}{stock <= threshold ? " · À réapprovisionner" : ""}</span></td>
          <td className="px-4 py-3 text-navy/60">{threshold}</td>
          <td className="px-4 py-3"><form action={adjustStock.bind(null, product.id, variant?.id ?? null)} className="flex min-w-[390px] items-center gap-2">
            <input name="delta" type="number" step="1" required placeholder="± quantité" aria-label="Variation du stock" className="w-28 rounded-lg border border-line px-2.5 py-2 text-xs" />
            <input name="reason" required maxLength={180} placeholder="Motif (réception, inventaire…)" aria-label="Motif du mouvement" className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-2 text-xs" />
            <button className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-light">Enregistrer</button>
          </form></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4"><h2 className="font-semibold text-navy">Historique récent des mouvements</h2></div>
      {movements.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-cream text-left text-[10px] uppercase tracking-wider text-navy/50"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Parfum / format</th><th className="px-4 py-3">Variation</th><th className="px-4 py-3">Avant → après</th><th className="px-4 py-3">Motif</th><th className="px-4 py-3">Par</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-t border-line"><td className="whitespace-nowrap px-4 py-3 text-navy/60">{movement.createdAt.toLocaleString("fr-FR")}</td><td className="px-4 py-3">{movement.product.name}{movement.variant ? ` · ${movement.variant.volumeLabel}` : ""}</td><td className={`px-4 py-3 font-semibold ${movement.delta > 0 ? "text-emerald-700" : "text-rose-dark"}`}>{movement.delta > 0 ? "+" : ""}{movement.delta}</td><td className="px-4 py-3 text-navy/60">{movement.previousStock} → {movement.nextStock}</td><td className="px-4 py-3">{movement.reason}</td><td className="px-4 py-3 text-navy/60">{movement.user?.name ?? "Système"}</td></tr>)}</tbody></table></div> : <p className="px-5 py-8 text-center text-sm text-navy/55">Aucun mouvement enregistré. Le premier ajustement apparaîtra ici.</p>}
    </section>
  </div>;
}
