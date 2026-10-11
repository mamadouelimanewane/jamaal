import Link from "next/link";
import { ReservationsBanner } from "@/components/admin/ReservationsBanner";
import { AlertTriangle, ArrowDownToLine, Boxes, ClipboardList, History, PackageX, Wallet } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getStockRows, stockTotals, type StockRow } from "@/lib/inventory-report";
import { getCategories } from "@/lib/db-categories";
import { formatPrice } from "@/lib/currency";
import { StockTableRow } from "@/components/admin/StockTableRow";
import { LiveSearchInput } from "@/components/admin/LiveSearchInput";
import { filterStockRows, rankProducts } from "@/lib/admin-search";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const FILTERS = [
  { id: "", label: "Tout" },
  { id: "rupture", label: "Ruptures" },
  { id: "bas", label: "Stock bas" },
  { id: "commander", label: "À commander" },
  { id: "ok", label: "En stock" },
] as const;

const SORTS = [
  { id: "", label: "Pertinence (recherche) puis nom" },
  { id: "stock", label: "Stock croissant" },
  { id: "ventes", label: "Meilleures ventes 30 j" },
  { id: "couverture", label: "Couverture la plus courte" },
  { id: "valeur", label: "Valeur en stock" },
] as const;

export default async function AdminStockPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; statut?: string; tri?: string; page?: string }> }) {
  await requireAdminPage();
  const { q = "", cat = "", statut = "", tri = "", page = "1" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const [all, categories, ranking] = await Promise.all([getStockRows(), getCategories(), query ? rankProducts(query) : Promise.resolve(null)]);
  const totals = stockTotals(all);

  // Même moteur que la boutique : accents, fautes de frappe, parfum d'inspiration, codes de format.
  let rows: StockRow[] = ranking ? filterStockRows(all, query, ranking) : all;
  if (cat) rows = rows.filter((r) => r.category === cat);
  const counts = {
    rupture: rows.filter((r) => r.status === "rupture").length,
    bas: rows.filter((r) => r.status === "bas").length,
    commander: rows.filter((r) => r.toOrder > 0).length,
    ok: rows.filter((r) => r.status === "ok").length,
  };
  if (statut === "commander") rows = rows.filter((r) => r.toOrder > 0);
  else if (statut) rows = rows.filter((r) => r.status === statut);
  if (tri === "stock") rows = [...rows].sort((a, b) => a.stock - b.stock);
  if (tri === "ventes") rows = [...rows].sort((a, b) => b.sold30 - a.sold30);
  if (tri === "couverture") rows = [...rows].sort((a, b) => (a.coverageDays ?? 1e9) - (b.coverageDays ?? 1e9));
  if (tri === "valeur") rows = [...rows].sort((a, b) => b.stock * (b.unitCost ?? 0) - a.stock * (a.unitCost ?? 0));

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  const shown = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: query, cat, statut, tri, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/stocks${s ? `?${s}` : ""}`;
  };
  const productCats = categories.filter((c) => all.some((r) => r.category === c.slug));

  const kpis = [
    { label: "Formats suivis", value: totals.formats.toLocaleString("fr-FR"), sub: `${totals.products} produits`, icon: Boxes, tone: "text-navy" },
    { label: "Unités en stock", value: totals.units.toLocaleString("fr-FR"), sub: "tous formats", icon: ClipboardList, tone: "text-navy" },
    { label: "Valeur d'achat", value: formatPrice(totals.costValue), sub: `Valeur de vente ${formatPrice(totals.saleValue)}`, icon: Wallet, tone: "text-navy" },
    { label: "Ruptures", value: totals.outOfStock.toLocaleString("fr-FR"), sub: "formats à 0", icon: PackageX, tone: totals.outOfStock ? "text-red-700" : "text-navy" },
    { label: "Sous le seuil", value: totals.low.toLocaleString("fr-FR"), sub: `${totals.toOrder} à commander`, icon: AlertTriangle, tone: totals.low ? "text-amber-700" : "text-navy" },
  ];

  return (
    <div className="space-y-6">
      <ReservationsBanner />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-dark">Inventaire JAMAAL</p>
          <h1 className="mt-1 font-serif-display text-3xl font-semibold text-navy">Stocks</h1>
          <p className="mt-1 text-[15px] text-navy/75">Chaque format de chaque produit, ses ventes et ce qu&apos;il faut recommander. Tout mouvement est tracé.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/stocks/reception" className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"><ClipboardList size={16} /> Réception / inventaire</Link>
          <Link href="/admin/stocks/mouvements" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:border-navy"><History size={16} /> Historique</Link>
          <a href="/api/export/stocks" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:border-navy"><ArrowDownToLine size={16} /> Excel</a>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between text-sm text-navy/75">{k.label}<k.icon size={17} className="text-navy/40" /></div>
            <p className={`mt-1 whitespace-nowrap text-xl font-semibold xl:text-2xl ${k.tone}`}>{k.value}</p>
            <p className="text-xs text-navy/65">{k.sub}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" action="/admin/stocks">
          <label className="min-w-[220px] flex-1 text-xs font-medium text-navy/80">
            Rechercher
            <Suspense>
              <LiveSearchInput key={query} initial={query} placeholder="Nom, code (001M, 301M…), parfum (Sauvage), marque, « 30 ml »" className="mt-1" />
            </Suspense>
          </label>
          <label className="text-xs font-medium text-navy/80">
            Collection
            <select name="cat" defaultValue={cat} className="mt-1 block rounded-lg border border-line px-3 py-2 text-sm">
              <option value="">Toutes</option>
              {productCats.map((c) => <option key={c.slug} value={c.slug}>{c.navLabel.replace("JAMAAL ", "")}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-navy/80">
            Trier par
            <select name="tri" defaultValue={tri} className="mt-1 block rounded-lg border border-line px-3 py-2 text-sm">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          {statut && <input type="hidden" name="statut" value={statut} />}
          <button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">Filtrer</button>
          {(query || cat || statut || tri) && <Link href="/admin/stocks" className="py-2 text-sm text-navy/70 hover:text-navy">Réinitialiser</Link>}
        </form>
        {ranking?.corrected && <p className="px-4 pt-3 text-sm text-navy/75">Résultats pour <strong>{ranking.corrected}</strong> (orthographe corrigée).</p>}
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {FILTERS.map((f) => {
            const n = f.id ? counts[f.id as keyof typeof counts] : undefined;
            const on = statut === f.id;
            return (
              <Link key={f.id} href={link({ statut: f.id || undefined, page: undefined })} className={`rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-navy bg-navy text-white" : "border-line text-navy hover:border-navy"}`}>
                {f.label}{n !== undefined ? <span className={on ? "text-white/75" : "text-navy/55"}> {n}</span> : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-cream text-left text-xs uppercase tracking-wider text-navy/70">
              <tr>
                <th className="px-4 py-3">Produit Chogan · inspiration</th>
                <th className="px-3 py-3">Code du format</th>
                <th className="px-3 py-3">Format</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3" title="Alerte quand le stock descend à ce niveau">Seuil</th>
                <th className="px-3 py-3 text-right">Ventes 30 j</th>
                <th className="px-3 py-3 text-right" title="Nombre de jours avant rupture au rythme des 30 derniers jours">Couverture</th>
                <th className="px-3 py-3 text-right" title="Pour tenir 30 jours, au moins 2 × le seuil">À commander</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => <StockTableRow key={r.key} row={r} />)}
            </tbody>
          </table>
          {!shown.length && <p className="px-5 py-10 text-center text-[15px] text-navy/70">Aucun article ne correspond à ces filtres{query ? ` (« ${query} »)` : ""}. Essayez un code, un nom de parfum ou une marque.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-navy/75">
          <span>{rows.length.toLocaleString("fr-FR")} ligne(s){pages > 1 ? ` · page ${current} sur ${pages}` : ""}</span>
          {pages > 1 && (
            <div className="flex gap-2">
              {current > 1 && <Link href={link({ page: String(current - 1) })} className="rounded-lg border border-line px-3 py-1.5 font-semibold text-navy hover:border-navy">Précédente</Link>}
              {current < pages && <Link href={link({ page: String(current + 1) })} className="rounded-lg border border-line px-3 py-1.5 font-semibold text-navy hover:border-navy">Suivante</Link>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
