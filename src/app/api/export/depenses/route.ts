import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";
import { CHANNELS, LEGACY_CATEGORY_ACCOUNT, labelFor } from "@/lib/accounting/chart";
import { getAccounts } from "@/lib/accounting/ledger";
import { parsePeriod } from "@/lib/accounting/period";

export async function GET(req: Request) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const period = parsePeriod(sp, new Date(), new Date("2000-01-01T00:00:00Z"), "tout");
  const [expenses, accounts] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: period.from, lt: period.to } },
      orderBy: { date: "desc" },
      select: { date: true, label: true, amount: true, vatAmount: true, account: true, category: true, channel: true, supplier: true, reference: true, paid: true, paidAt: true, dueDate: true, note: true },
    }),
    getAccounts(),
  ]);
  const d = (x: Date | null) => (x ? x.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "");
  return excelResponse("depenses-jamaal.xlsx", [
    {
      name: "Dépenses",
      columns: [
        { header: "Date", key: "date", width: 12 },
        { header: "Libellé", key: "label", width: 40 },
        { header: "Fournisseur", key: "supplier", width: 20 },
        { header: "N° pièce", key: "reference", width: 14 },
        { header: "Compte", key: "account", width: 10 },
        { header: "Nature", key: "nature", width: 34 },
        { header: "Montant TTC (FCFA)", key: "amount", width: 16 },
        { header: "dont TVA", key: "vat", width: 12 },
        { header: "Montant HT", key: "ht", width: 14 },
        { header: "Payée", key: "paid", width: 8 },
        { header: "Moyen", key: "channel", width: 18 },
        { header: "Payée le", key: "paidAt", width: 12 },
        { header: "Échéance", key: "due", width: 12 },
        { header: "Note", key: "note", width: 30 },
      ],
      rows: expenses.map((e) => {
        const acc = e.account || LEGACY_CATEGORY_ACCOUNT[e.category] || "638";
        return {
          date: d(e.date), label: e.label, supplier: e.supplier ?? "", reference: e.reference ?? "", account: acc, nature: labelFor(acc, accounts),
          amount: e.amount, vat: e.vatAmount, ht: e.amount - e.vatAmount, paid: e.paid ? "Oui" : "Non", channel: CHANNELS[e.channel]?.label ?? e.channel,
          paidAt: d(e.paidAt), due: d(e.dueDate), note: e.note ?? "",
        };
      }),
    },
  ]);
}
