import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const expenses = await prisma.expense.findMany({ orderBy: { date: "desc" } });

  return excelResponse("depenses-jamaal.xlsx", [
    {
      name: "Dépenses",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Libellé", key: "label", width: 40 },
        { header: "Catégorie", key: "category", width: 20 },
        { header: "Montant (FCFA)", key: "amount", width: 18 },
      ],
      rows: expenses.map((e) => ({
        date: e.date.toLocaleDateString("fr-FR"),
        label: e.label,
        category: e.category,
        amount: e.amount,
      })),
    },
  ]);
}
