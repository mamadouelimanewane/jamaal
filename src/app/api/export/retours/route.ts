import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const returns = await prisma.return.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: true },
  });

  return excelResponse("retours-jamaal.xlsx", [
    {
      name: "Retours",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Client", key: "client", width: 24 },
        { header: "Motif", key: "reason", width: 30 },
        { header: "Montant (FCFA)", key: "amount", width: 16 },
        { header: "Statut", key: "status", width: 14 },
        { header: "Traité le", key: "processedAt", width: 14 },
      ],
      rows: returns.map((r) => ({
        date: r.createdAt.toLocaleDateString("fr-FR"),
        client: r.order.customerName,
        reason: r.reason,
        amount: r.amount,
        status: r.status,
        processedAt: r.processedAt ? r.processedAt.toLocaleDateString("fr-FR") : "",
      })),
    },
  ]);
}
