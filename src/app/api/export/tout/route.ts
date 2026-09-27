import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { buildWorkbook, type ExcelSheet } from "@/lib/excel";
import { getConsultantRankings, RANK_LABELS } from "@/lib/ranking";
import { getConsultantCommission } from "@/lib/commission";
import { getRefundedTotal } from "@/lib/revenue";
import { getCommissionRate } from "@/lib/settings";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const [
    products,
    orders,
    clients,
    expenses,
    returns,
    consultants,
    rankings,
    revenueAgg,
    expenseAgg,
    refundedTotal,
    rate,
  ] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, include: { consultant: true, livreur: true, items: true } }),
    prisma.customer.findMany({ orderBy: { updatedAt: "desc" }, include: { orders: { select: { total: true, status: true } } } }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
    prisma.return.findMany({ orderBy: { createdAt: "desc" }, include: { order: true } }),
    prisma.consultant.findMany({
      orderBy: { name: "asc" },
      include: { sponsor: { select: { name: true } }, orders: { select: { total: true, status: true } } },
    }),
    getConsultantRankings(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "ANNULEE" } } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    getRefundedTotal(),
    getCommissionRate(),
  ]);

  const rankById = new Map(rankings.map((r) => [r.consultantId, r]));
  const revenue = Math.max(0, (revenueAgg._sum.total ?? 0) - refundedTotal);
  const totalExpenses = expenseAgg._sum.amount ?? 0;

  const revendeurRows = [];
  for (const c of consultants) {
    const commission = await getConsultantCommission(c.id);
    const info = rankById.get(c.id);
    revendeurRows.push({
      name: c.name,
      city: c.city,
      whatsapp: c.whatsapp,
      sponsor: c.sponsor?.name ?? "",
      rank: info?.rank ? RANK_LABELS[info.rank] : "—",
      monthlyRevenue: info?.monthlyRevenue ?? 0,
      lifetimeRevenue: commission.lifetimeRevenue,
      monthlyCommission: commission.monthlyCommission,
      lifetimeCommission: commission.lifetimeCommission,
      orderCount: c.orders.length,
      active: c.active ? "Oui" : "Non",
    });
  }

  const sheets: ExcelSheet[] = [
    {
      name: "Résumé",
      columns: [
        { header: "Indicateur", key: "label", width: 30 },
        { header: "Valeur", key: "value", width: 20 },
      ],
      rows: [
        { label: "Chiffre d'affaires net (FCFA)", value: revenue },
        { label: "Dépenses (FCFA)", value: totalExpenses },
        { label: "Remboursements (FCFA)", value: refundedTotal },
        { label: "Taux de commission (%)", value: rate },
        { label: "Marge nette (FCFA)", value: revenue - totalExpenses },
        { label: "Nombre de produits", value: products.length },
        { label: "Nombre de commandes", value: orders.length },
        { label: "Nombre de clients", value: clients.length },
        { label: "Nombre de revendeurs", value: consultants.length },
        { label: "Date d'export", value: new Date().toLocaleString("fr-FR") },
      ],
    },
    {
      name: "Produits",
      columns: [
        { header: "Nom", key: "name", width: 40 },
        { header: "Catégorie", key: "category", width: 20 },
        { header: "Prix régulier (FCFA)", key: "price", width: 18 },
        { header: "Stock", key: "stock", width: 10 },
        { header: "Seuil alerte", key: "threshold", width: 12 },
      ],
      rows: products.map((p) => ({
        name: p.name,
        category: p.category,
        price: p.regularPrice ?? "",
        stock: p.stock,
        threshold: p.lowStockThreshold,
      })),
    },
    {
      name: "Commandes",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Client", key: "client", width: 24 },
        { header: "Total (FCFA)", key: "total", width: 16 },
        { header: "Statut", key: "status", width: 14 },
        { header: "Revendeur", key: "consultant", width: 20 },
        { header: "Livreur", key: "livreur", width: 18 },
      ],
      rows: orders.map((o) => ({
        date: o.createdAt.toLocaleDateString("fr-FR"),
        client: o.customerName,
        total: o.total,
        status: o.status,
        consultant: o.consultant?.name ?? "",
        livreur: o.livreur?.name ?? "",
      })),
    },
    {
      name: "Clients",
      columns: [
        { header: "Nom", key: "name", width: 24 },
        { header: "Téléphone", key: "phone", width: 16 },
        { header: "Nb commandes", key: "orderCount", width: 14 },
        { header: "Total dépensé (FCFA)", key: "total", width: 18 },
      ],
      rows: clients.map((c) => ({
        name: c.name,
        phone: c.phone,
        orderCount: c.orders.length,
        total: c.orders.filter((o) => o.status !== "ANNULEE").reduce((sum, o) => sum + o.total, 0),
      })),
    },
    {
      name: "Revendeurs",
      columns: [
        { header: "Nom", key: "name", width: 24 },
        { header: "Ville", key: "city", width: 16 },
        { header: "Parrain", key: "sponsor", width: 20 },
        { header: "Rang", key: "rank", width: 14 },
        { header: "CA du mois (FCFA)", key: "monthlyRevenue", width: 16 },
        { header: "Commission totale (FCFA)", key: "lifetimeCommission", width: 20 },
      ],
      rows: revendeurRows,
    },
    {
      name: "Dépenses",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Libellé", key: "label", width: 40 },
        { header: "Catégorie", key: "category", width: 20 },
        { header: "Montant (FCFA)", key: "amount", width: 16 },
      ],
      rows: expenses.map((e) => ({
        date: e.date.toLocaleDateString("fr-FR"),
        label: e.label,
        category: e.category,
        amount: e.amount,
      })),
    },
    {
      name: "Retours",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Client", key: "client", width: 24 },
        { header: "Motif", key: "reason", width: 30 },
        { header: "Montant (FCFA)", key: "amount", width: 16 },
        { header: "Statut", key: "status", width: 14 },
      ],
      rows: returns.map((r) => ({
        date: r.createdAt.toLocaleDateString("fr-FR"),
        client: r.order.customerName,
        reason: r.reason,
        amount: r.amount,
        status: r.status,
      })),
    },
  ];

  const buffer = await buildWorkbook(sheets);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jamaal-export-complet.xlsx"`,
    },
  });
}
