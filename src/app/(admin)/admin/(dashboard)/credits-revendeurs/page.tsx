import Link from "next/link";
import type { GoodsCreditStatus, Prisma } from "@prisma/client";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { CREDIT_STATUS_LABELS } from "@/lib/goods-credit";
import { GoodsCreditGrantForm } from "@/components/admin/GoodsCreditGrantForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crédits revendeurs" };

const STATUS_CLS: Record<GoodsCreditStatus, string> = {
  EN_COURS: "bg-amber-100 text-amber-900",
  SOLDE: "bg-emerald-100 text-emerald-800",
  ANNULE: "bg-navy/10 text-navy/70",
};
const date = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Crédits de marchandises accordés aux revendeurs, remboursés automatiquement par leurs ventes. */
export default async function GoodsCreditsPage({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; revendeur?: string }> }) {
  await requireAdminPage("revendeurs");
  const { statut = "EN_COURS", q = "", revendeur } = await searchParams;
  const status = (["EN_COURS", "SOLDE", "ANNULE"] as const).find((s) => s === statut);
  const query = q.trim().slice(0, 60);

  const where: Prisma.GoodsCreditWhereInput = {
    ...(status ? { status } : {}),
    ...(revendeur ? { consultantId: revendeur } : {}),
    ...(query
      ? { OR: [{ reference: { contains: query, mode: "insensitive" } }, { consultant: { OR: [{ name: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }, { whatsapp: { contains: query.replace(/\s/g, "") } }] } }] }
      : {}),
  };
  const [credits, open, all, consultants, debts, counts] = await Promise.all([
    prisma.goodsCredit.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { consultant: { select: { id: true, name: true, city: true } } } }),
    prisma.goodsCredit.aggregate({ where: { status: "EN_COURS" }, _sum: { balance: true } }),
    prisma.goodsCredit.aggregate({ where: { status: { not: "ANNULE" } }, _sum: { amount: true, repaid: true } }),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, city: true, whatsapp: true } }),
    prisma.goodsCredit.groupBy({ by: ["consultantId"], where: { status: "EN_COURS" }, _sum: { balance: true } }),
    prisma.goodsCredit.groupBy({ by: ["status"], _count: true }),
  ]);
  const debtBy = new Map(debts.map((d) => [d.consultantId, d._sum.balance ?? 0]));
  const countBy = new Map(counts.map((c) => [c.status, c._count]));
  const sales = await prisma.goodsCreditDeduction.aggregate({ where: { kind: { in: ["VENTE", "ANNULATION_VENTE"] } }, _sum: { amount: true } });

  const kpis: [string, string][] = [
    ["Créance totale en cours", formatPrice(open._sum.balance ?? 0)],
    ["Marchandises confiées", formatPrice(all._sum.amount ?? 0)],
    ["Remboursé par les ventes", formatPrice(sales._sum.amount ?? 0)],
    ["Revendeurs sous crédit", String(debts.filter((d) => (d._sum.balance ?? 0) > 0).length)],
  ];
  const tabs: [string, string, number][] = [
    ["EN_COURS", "En cours", countBy.get("EN_COURS") ?? 0],
    ["SOLDE", "Soldés", countBy.get("SOLDE") ?? 0],
    ["ANNULE", "Annulés", countBy.get("ANNULE") ?? 0],
    ["tous", "Tous", [...countBy.values()].reduce((a, b) => a + b, 0)],
  ];
  const href = (s: string) => `/admin/credits-revendeurs?statut=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Crédits revendeurs</h1>
        <p className="mt-1 max-w-3xl text-sm text-navy/75">
          Marchandises confiées à crédit. Chaque vente du revendeur payée à JAMAAL (en ligne, paiement reçu, espèces encaissées par le livreur) est défalquée automatiquement de ce qu&apos;il doit, en commençant par son crédit le plus ancien. Une vente annulée est rendue au crédit.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="mt-1 text-xl font-semibold text-navy">{v}</p></div>
        ))}
      </div>

      <GoodsCreditGrantForm resellers={consultants.map((c) => ({ ...c, debt: debtBy.get(c.id) ?? 0 }))} preselected={revendeur ?? null} />

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <nav className="flex flex-wrap gap-1.5">
            {tabs.map(([k, l, n]) => (
              <Link key={k} href={href(k)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${(status ?? "tous") === k ? "bg-navy text-white" : "bg-cream text-navy hover:bg-cream/70"}`}>{l} <span className="opacity-70">{n}</span></Link>
            ))}
          </nav>
          <form className="ml-auto flex gap-2">
            <input type="hidden" name="statut" value={status ?? "tous"} />
            <input name="q" defaultValue={query} placeholder="Revendeur, ville, téléphone, CM-…" className="w-64 rounded-xl border border-line px-3 py-2 text-sm" />
            <button className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-navy hover:border-navy">Chercher</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-navy/60">
              <tr>
                <th className="px-4 py-3">Crédit</th>
                <th className="px-3 py-3">Revendeur</th>
                <th className="px-3 py-3 text-right">Confié</th>
                <th className="px-3 py-3 text-right">Remboursé</th>
                <th className="px-3 py-3 text-right">Reste dû</th>
                <th className="px-3 py-3">Avancement</th>
                <th className="px-3 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => {
                const pct = c.amount ? Math.min(100, Math.round((c.repaid / c.amount) * 100)) : 0;
                const late = c.status === "EN_COURS" && c.dueDate && c.dueDate < new Date();
                return (
                  <tr key={c.id} className="border-t border-line hover:bg-cream/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/credits-revendeurs/${c.id}`} className="font-semibold text-navy hover:underline">{c.reference}</Link>
                      <span className="block text-xs text-navy/60">{date(c.createdAt)}{c.dueDate ? ` · échéance ${date(c.dueDate)}` : ""}</span>
                      {late && <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 text-[11px] font-semibold text-red-800">Échéance dépassée</span>}
                    </td>
                    <td className="px-3 py-3"><Link href={`/admin/consultants/${c.consultant.id}`} className="font-medium text-navy hover:underline">{c.consultant.name}</Link><span className="block text-xs text-navy/60">{c.consultant.city}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatPrice(c.amount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-800">{formatPrice(c.repaid)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-navy">{formatPrice(c.balance)}</td>
                    <td className="px-3 py-3"><div className="h-2 w-28 rounded-full bg-cream"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div><span className="text-xs text-navy/60">{pct} %</span></td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[c.status]}`}>{CREDIT_STATUS_LABELS[c.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!credits.length && <p className="px-5 py-10 text-center text-sm text-navy/65">Aucun crédit {status ? `« ${CREDIT_STATUS_LABELS[status].toLowerCase()} »` : ""}{query ? ` pour « ${query} »` : ""}.</p>}
        </div>
      </div>
    </div>
  );
}
