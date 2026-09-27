import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const expenses = await prisma.expense.findMany({ orderBy: { date: "desc" } });
  const csv = toCsv(
    ["Date", "Libellé", "Catégorie", "Montant (FCFA)"],
    expenses.map((e) => [e.date.toLocaleDateString("fr-FR"), e.label, e.category, e.amount])
  );
  return csvResponse("depenses-jamaal.csv", csv);
}
