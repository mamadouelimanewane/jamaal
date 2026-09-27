import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return excelResponse("produits-jamaal.xlsx", [
    {
      name: "Produits",
      columns: [
        { header: "Nom", key: "name", width: 40 },
        { header: "Catégorie", key: "category", width: 20 },
        { header: "Prix régulier (FCFA)", key: "price", width: 20 },
        { header: "Stock", key: "stock", width: 12 },
        { header: "Seuil alerte", key: "threshold", width: 14 },
        { header: "Numéro", key: "number", width: 12 },
        { header: "Slug", key: "slug", width: 30 },
      ],
      rows: products.map((p) => ({
        name: p.name,
        category: p.category,
        price: p.regularPrice ?? "",
        stock: p.stock,
        threshold: p.lowStockThreshold,
        number: p.number ?? "",
        slug: p.slug,
      })),
    },
  ]);
}
