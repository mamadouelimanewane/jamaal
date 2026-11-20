import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { ReconciliationCsv } from "@/components/admin/AdminOperationsActions";

export const dynamic = "force-dynamic";

function ninetyDaysAgo() {
  return new Date(Date.now() - 90 * 86_400_000);
}

export default async function ReconciliationPage() {
  await requireAdminPage("comptabilite");
  const since = ninetyDaysAgo();
  const [entries, pending, failed, paidOrdersWithoutCommission] = await Promise.all([
    prisma.commissionEntry.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500, include: { consultant: { select: { name: true } }, payout: { select: { id: true, status: true, provider: true, providerRef: true } } } }),
    prisma.commissionEntry.aggregate({ where: { status: "A_VERSER", amount: { gt: 0 } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payout.aggregate({ where: { status: "ECHEC", createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.findMany({ where: { status: { not: "ANNULEE" }, paymentStatus: "PAYE", paidAt: { gte: since }, consultantId: { not: null } }, orderBy: { paidAt: "desc" }, take: 500, select: { id: true, customerName: true, total: true, paidAt: true, consultant: { select: { name: true } } } }),
  ]);
  const paidOrderIds = paidOrdersWithoutCommission.map((o) => o.id);
  const linkedEntries = paidOrderIds.length ? await prisma.commissionEntry.findMany({ where: { orderId: { in: paidOrderIds } }, select: { orderId: true } }) : [];
  const linkedOrderIds = new Set(linkedEntries.map((e) => e.orderId));
  const missingCommissionOrders = paidOrdersWithoutCommission.filter((o) => !linkedOrderIds.has(o.id)).slice(0, 40);
  const exportRows = entries.map(e=>({date:e.createdAt.toISOString(),consultant:e.consultant.name,orderId:e.orderId,level:e.level,amount:e.amount,status:e.status,payout:e.payout?`${e.payout.provider} · ${e.payout.status} · ${e.payout.providerRef ?? e.payout.id}`:"—"}));
  return <main className="max-w-6xl space-y-5"><header><p className="text-xs font-semibold uppercase tracking-widest text-ia">Pilotage · finances</p><h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Rapprochement paiements et commissions</h1><p className="mt-1 text-sm text-navy/70">Rapprochez ventes réglées, commissions calculées et versements wallet. Période détaillée : 90 derniers jours.</p></header><div className="grid gap-3 sm:grid-cols-3">{[["Commissions à verser",formatPrice(pending._sum.amount??0),`${pending._count._all} ligne(s)`],["Payouts échoués (90 j)",formatPrice(failed._sum.amount??0),`${failed._count._all} opération(s)`],["Commandes payées sans commission",missingCommissionOrders.length, "À examiner · limité aux 40 plus récentes"]].map(([title,value,sub])=><div key={String(title)} className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>)}</div>{missingCommissionOrders.length>0&&<section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold text-amber-950">Ventes réglées à vérifier</h2><p className="mt-1 text-xs text-amber-900">Cette alerte signale l’absence de ligne de commission liée ; vérifiez les règles et le type de vente avant correction.</p><ul className="mt-3 divide-y divide-amber-200">{missingCommissionOrders.map(o=><li key={o.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{o.consultant?.name ?? "Vendeur inconnu"} · {o.customerName} · {o.id.slice(-8).toUpperCase()}</span><span>{formatPrice(o.total)} · {o.paidAt?.toLocaleDateString("fr-FR")}</span></li>)}</ul></section>}<div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Lignes de commissions ({entries.length} affichées)</h2><div className="flex gap-2"><ReconciliationCsv rows={exportRows}/><Link href="/admin/wallets" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Ouvrir les wallets</Link></div></div><section className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Date","Bénéficiaire","Commande","Niveau","Commission","Statut","Versement"].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{entries.map(e=><tr key={e.id} className="border-t"><td className="whitespace-nowrap p-3">{e.createdAt.toLocaleDateString("fr-FR")}</td><td className="p-3">{e.consultant.name}</td><td className="p-3 font-mono text-xs">{e.orderId.slice(-8).toUpperCase()}</td><td className="p-3">{e.level}</td><td className="p-3 font-semibold">{formatPrice(e.amount)}</td><td className="p-3">{e.status}</td><td className="p-3">{e.payout?`${e.payout.provider} · ${e.payout.status}`:"Pas encore versée"}</td></tr>)}{!entries.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-600">Aucune commission sur cette période.</td></tr>}</tbody></table></div></section><p className="text-xs text-slate-500">Cette vue est un outil de contrôle, elle ne modifie aucun solde et ne déclenche aucun paiement. Les payouts Wave existants restent inchangés.</p></main>;
}
