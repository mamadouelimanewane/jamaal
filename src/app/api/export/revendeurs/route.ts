import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";
import { getConsultantRankings, RANK_LABELS } from "@/lib/ranking";
import { getConsultantCommission } from "@/lib/commission";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const [consultants, rankings] = await Promise.all([
    prisma.consultant.findMany({
      orderBy: { name: "asc" },
      include: { sponsor: { select: { name: true } }, orders: { select: { total: true, status: true } } },
    }),
    getConsultantRankings(),
  ]);
  const rankById = new Map(rankings.map((r) => [r.consultantId, r]));

  const rows = [];
  for (const c of consultants) {
    const commission = await getConsultantCommission(c.id);
    const info = rankById.get(c.id);
    rows.push({
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

  return excelResponse("consultants-jamaal.xlsx", [
    {
      name: "Consultants",
      columns: [
        { header: "Nom", key: "name", width: 24 },
        { header: "Ville", key: "city", width: 16 },
        { header: "WhatsApp", key: "whatsapp", width: 26 },
        { header: "Parrain", key: "sponsor", width: 20 },
        { header: "Rang (mois en cours)", key: "rank", width: 18 },
        { header: "CA du mois (FCFA)", key: "monthlyRevenue", width: 16 },
        { header: "CA total (FCFA)", key: "lifetimeRevenue", width: 16 },
        { header: "Commission du mois (FCFA)", key: "monthlyCommission", width: 20 },
        { header: "Commission totale (FCFA)", key: "lifetimeCommission", width: 20 },
        { header: "Nb commandes", key: "orderCount", width: 14 },
        { header: "Actif", key: "active", width: 10 },
      ],
      rows,
    },
  ]);
}
