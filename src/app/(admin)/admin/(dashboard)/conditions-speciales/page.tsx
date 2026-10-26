import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { walletBalance } from "@/lib/wallet";
import { formatPrice } from "@/lib/currency";
import { COLLECT_LABELS, isCollectMethod, parseZones } from "@/lib/special-terms";
import { deleteSpecialTerms } from "@/lib/actions/special-terms";
import { RowAction } from "@/components/admin/RowAction";
import { normalRates } from "./data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conditions spéciales" };

/** Conditions spéciales accordées à certains revendeurs : encaissement direct, commission propre, zones de livraison. */
export default async function SpecialTermsPage() {
  await requireAdminPage("revendeurs");
  const [terms, rates] = await Promise.all([
    prisma.specialTerms.findMany({ orderBy: { createdAt: "asc" }, include: { consultants: { select: { id: true, name: true, city: true }, orderBy: { name: "asc" } } } }),
    normalRates(),
  ]);
  const balances = new Map<string, number>();
  await Promise.all(terms.flatMap((t) => t.consultants).map(async (c) => balances.set(c.id, (await walletBalance({ type: "CONSULTANT", id: c.id })).balance)));
  const owedTotal = [...balances.values()].reduce((s, b) => s + Math.max(0, -b), 0);
  const pct = (v: number | null, normal: string) => (v == null ? <span className="text-navy/55">normal ({normal})</span> : <strong>{v.toLocaleString("fr-FR")} %</strong>);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Conditions spéciales</h1>
          <p className="mt-1 max-w-3xl text-sm text-navy/75">Un traitement à part pour un ou plusieurs revendeurs : encaisser eux-mêmes leur client (espèces, Wave, Orange Money), toucher une commission différente, livrer dans des zones à tarif propre. Les autres revendeurs gardent le régime normal.</p>
        </div>
        <Link href="/admin/conditions-speciales/nouveau" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">+ Nouvelles conditions</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Ensembles de conditions", String(terms.length)], ["Revendeurs concernés", String(balances.size)], ["Argent encaissé à reverser", formatPrice(owedTotal)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="text-xl font-semibold text-navy">{v}</p></div>
        ))}
      </div>

      {terms.map((t) => {
        const zones = parseZones(t.zones);
        return (
          <article key={t.id} className={`rounded-2xl border bg-white p-5 ${t.active ? "border-line" : "border-dashed border-line opacity-75"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy">{t.name} {!t.active && <span className="ml-1 rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-navy/70">désactivées</span>}</h2>
                {t.note && <p className="mt-0.5 text-sm text-navy/70">{t.note}</p>}
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/conditions-speciales/${t.id}`} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-navy hover:bg-cream">Modifier</Link>
                <RowAction label="Supprimer" danger run={deleteSpecialTerms.bind(null, t.id)} confirm={`Supprimer « ${t.name} » ? Ses revendeurs repassent au régime normal.`} />
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-cream/60 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy/60">Encaissement direct</dt>
                <dd className="mt-1 text-navy">{t.collectMethods.length ? t.collectMethods.map((m) => (isCollectMethod(m) ? COLLECT_LABELS[m] : m)).join(", ") : <span className="text-navy/55">non</span>}</dd>
                {t.collectMethods.length > 0 && <dd className="text-xs text-navy/70">Plafond à reverser : {formatPrice(t.creditLimit)}</dd>}
              </div>
              <div className="rounded-xl bg-cream/60 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy/60">Commission</dt>
                <dd className="mt-1 text-navy">Vendeur : {pct(t.sellerPct, rates.seller)}</dd>
                <dd className="text-navy">Parrain : {pct(t.level1Pct, rates.level1)}</dd>
                <dd className="text-navy">Grand-parrain : {pct(t.level2Pct, rates.level2)}</dd>
              </div>
              <div className="rounded-xl bg-cream/60 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy/60">Zones de livraison</dt>
                {zones.length ? zones.map((z) => <dd key={z.name} className="text-navy">{z.name} · {formatPrice(z.fee)}</dd>) : <dd className="mt-1 text-navy/55">tarif normal au km</dd>}
              </div>
            </dl>
            <h3 className="mt-4 text-sm font-semibold text-navy">Revendeurs ({t.consultants.length})</h3>
            {t.consultants.length ? (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
                {t.consultants.map((c) => {
                  const b = balances.get(c.id) ?? 0;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <Link href={`/admin/consultants/${c.id}`} className="font-medium text-navy hover:underline">{c.name} <span className="font-normal text-navy/55">· {c.city}</span></Link>
                      <span className={b < 0 ? "font-semibold text-rose-dark" : "text-navy/70"}>{b < 0 ? `À reverser : ${formatPrice(-b)}` : `Wallet : ${formatPrice(b)}`}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-navy/60">Aucun revendeur : cliquez sur Modifier pour en choisir.</p>
            )}
          </article>
        );
      })}
      {!terms.length && <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-navy/70">Aucune condition spéciale : tous les revendeurs sont au régime normal.</p>}
      <p className="text-xs text-navy/60">Quand un revendeur reverse l&apos;argent encaissé, enregistrez-le dans <Link href="/admin/wallets" className="underline">Admin › Wallets</Link> (dépôt sur son wallet).</p>
    </div>
  );
}
