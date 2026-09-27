import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { consultant: true, livreur: true, items: true },
  });

  const csv = toCsv(
    ["Date", "Client", "Téléphone", "Total (FCFA)", "Statut", "Revendeur", "Livreur", "Mode de livraison", "Articles"],
    orders.map((o) => [
      o.createdAt.toLocaleDateString("fr-FR"),
      o.customerName,
      o.customerPhone ?? "",
      o.total,
      o.status,
      o.consultant?.name ?? "",
      o.livreur?.name ?? "",
      o.deliveryMode,
      o.items.map((i) => `${i.productName} (${i.volumeLabel} x${i.quantity})`).join(" | "),
    ])
  );
  return csvResponse("commandes-jamaal.csv", csv);
}
