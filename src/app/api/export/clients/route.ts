import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const clients = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
    include: { orders: { select: { total: true, status: true } } },
  });

  return excelResponse("clients-jamaal.xlsx", [
    {
      name: "Clients",
      columns: [
        { header: "Nom", key: "name", width: 24 },
        { header: "Téléphone", key: "phone", width: 16 },
        { header: "E-mail", key: "email", width: 24 },
        { header: "Adresse", key: "address", width: 30 },
        { header: "Nb commandes", key: "orderCount", width: 14 },
        { header: "Total dépensé (FCFA)", key: "total", width: 18 },
        { header: "Notes", key: "notes", width: 30 },
      ],
      rows: clients.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email ?? "",
        address: c.address ?? "",
        orderCount: c.orders.length,
        total: c.orders.filter((o) => o.status !== "ANNULEE").reduce((sum, o) => sum + o.total, 0),
        notes: c.notes ?? "",
      })),
    },
  ]);
}
