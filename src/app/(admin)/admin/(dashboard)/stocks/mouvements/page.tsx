import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { MOVEMENT_LABELS, type MovementKind } from "@/lib/stock";

export const dynamic = "force-dynamic";
const PER_PAGE = 60;

export default async function StockMovementsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; du?: string; au?: string; page?: string }> }) {
  await requireAdminPage();
  const { q = "", type = "", du = "", au = "", page = "1" } = await searchParams;
  const where: Prisma.StockMovementWhereInput = {
    ...(type ? { kind: type } : {}),
    ...(du || au ? { createdAt: { ...(du ? { gte: new Date(`${du}T00:00:00`) } : {}), ...(au ? { lte: new Date(`${au}T23:59:59`) } : {}) } } : {}),
    ...(q.trim()
      ? { OR: [
          { product: { name: { contains: q.trim(), mode: "insensitive" } } },
          { product: { choganCode: { equals: q.trim(), mode: "insensitive" } } },
          { variant: { code: { equals: q.trim(), mode: "insensitive" } } },
          { reference: { contains: q.trim(), mode: "insensitive" } },
          { orderId: { endsWith: q.trim().toLowerCase() } },
        ] }
      : {}),
  };
  const current = Math.max(1, Number(page) || 1);
  const [total, movements, sums] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { product: { select: { id: true, name: true } }, variant: { select: { volumeLabel: true, code: true } }, user: { select: { name: true } } },
    }),
    prisma.stockMovement.groupBy({ by: ["kind"], where, _sum: { delta: true }, _count: true }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, type, du, au, ...over })) if (v) p.set(k, v);
    return `/admin/stocks/mouvements?${p.toString()}`;
  };
  const input = "mt-1 block rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";

  return (
    <div className="space-y-6">
      <Link href="/admin/stocks" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/75 hover:text-navy"><ArrowLeft size={16} /> Stocks</Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-dark">Traçabilité</p>
        <h1 className="mt-1 font-serif-display text-3xl font-semibold text-navy">Historique des mouvements</h1>
        <p className="mt-1 text-[15px] text-navy/75">Ventes, annulations, réceptions, inventaires, pertes et ajustements, avec leur auteur.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(MOVEMENT_LABELS) as MovementKind[]).map((k) => {
          const s = sums.find((x) => x.kind === k);
          return (
            <Link key={k} href={link({ type: type === k ? undefined : k, page: undefined })} className={`rounded-2xl border p-3 ${type === k ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}>
              <p className={`text-xs ${type === k ? "text-white/80" : "text-navy/70"}`}>{MOVEMENT_LABELS[k]}</p>
              <p className="text-lg font-semibold">{s ? `${(s._sum.delta ?? 0) > 0 ? "+" : ""}${(s._sum.delta ?? 0).toLocaleString("fr-FR")}` : "—"}</p>
              <p className={`text-xs ${type === k ? "text-white/70" : "text-navy/60"}`}>{s?._count ?? 0} mouvement(s)</p>
            </Link>
          );
        })}
      </section>

      <form action="/admin/stocks/mouvements" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="min-w-[200px] flex-1 text-xs font-medium text-navy/80">Produit, code, référence ou n° de commande<input name="q" defaultValue={q} className={`${input} w-full`} /></label>
        <label className="text-xs font-medium text-navy/80">Type
          <select name="type" defaultValue={type} className={input}><option value="">Tous</option>{(Object.keys(MOVEMENT_LABELS) as MovementKind[]).map((k) => <option key={k} value={k}>{MOVEMENT_LABELS[k]}</option>)}</select>
        </label>
        <label className="text-xs font-medium text-navy/80">Du<input type="date" name="du" defaultValue={du} className={input} /></label>
        <label className="text-xs font-medium text-navy/80">Au<input type="date" name="au" defaultValue={au} className={input} /></label>
        <button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">Filtrer</button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-cream text-left text-xs uppercase tracking-wider text-navy/70">
              <tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Produit</th><th className="px-3 py-3">Format</th><th className="px-3 py-3">Type</th><th className="px-3 py-3 text-right">Variation</th><th className="px-3 py-3">Avant → après</th><th className="px-3 py-3">Détail</th><th className="px-3 py-3">Par</th></tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-2.5 text-navy/75">{m.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-3 py-2.5"><Link href={`/admin/stocks?q=${encodeURIComponent(m.product.name)}`} className="font-medium text-ink hover:underline">{m.product.name}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-navy/80">{m.variant ? `${m.variant.volumeLabel}${m.variant.code ? ` · ${m.variant.code}` : ""}` : "Format unique"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{MOVEMENT_LABELS[m.kind as MovementKind] ?? m.kind}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${m.delta > 0 ? "text-emerald-700" : m.delta < 0 ? "text-rose-dark" : "text-navy/60"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-navy/75">{m.previousStock} → {m.nextStock}</td>
                  <td className="px-3 py-2.5 text-navy/85">
                    {m.reason}{m.reference ? <span className="text-navy/60"> · {m.reference}</span> : null}
                    {m.orderId ? <> · <Link href={`/admin/commandes/${m.orderId}`} className="font-semibold text-rose-dark hover:underline">commande</Link></> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-navy/75">{m.user?.name ?? (m.orderId ? "Boutique" : "Système")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!movements.length && <p className="px-5 py-10 text-center text-[15px] text-navy/70">Aucun mouvement pour ces filtres.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-navy/75">
          <span>{total.toLocaleString("fr-FR")} mouvement(s){pages > 1 ? ` · page ${current} sur ${pages}` : ""}</span>
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
