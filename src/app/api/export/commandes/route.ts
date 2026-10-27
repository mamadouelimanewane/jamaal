import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";

export async function GET() {
  const forbidden = await requireAdminForApi("commandes");
  if (forbidden) return forbidden;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      consultant: true,
      livreur: true,
      items: {
        include: {
          product: {
            select: { choganCode: true, name: true, inspiredBy: true, inspiredBrand: true },
          },
        },
      },
    },
  });

  return excelResponse("commandes-jamaal.xlsx", [
    {
      name: "Commandes",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Client", key: "client", width: 24 },
        { header: "Téléphone", key: "phone", width: 16 },
        { header: "Total (FCFA)", key: "total", width: 16 },
        { header: "Statut", key: "status", width: 14 },
        { header: "Consultant", key: "consultant", width: 20 },
        { header: "Livreur", key: "livreur", width: 18 },
        { header: "Mode de livraison", key: "deliveryMode", width: 20 },
        { header: "Détail des articles (Code, Nom, Inspiré, Contenance, Prix)", key: "items", width: 65 },
      ],
      rows: orders.map((o) => ({
        date: o.createdAt.toLocaleDateString("fr-FR"),
        client: o.customerName,
        phone: o.customerPhone ?? "",
        total: o.total,
        status: o.status,
        consultant: o.consultant?.name ?? "",
        livreur: o.livreur?.name ?? "",
        deliveryMode: o.deliveryMode,
        items: o.items
          .map((i) => {
            const code = i.product?.choganCode ? `[${i.product.choganCode}] ` : "";
            const inspired = i.product?.inspiredBy ? ` (Inspiré de: ${i.product.inspiredBy})` : "";
            return `${code}${i.productName}${inspired} — ${i.volumeLabel} — ${i.price} FCFA x${i.quantity}`;
          })
          .join(" | "),
      })),
    },
  ]);
}
