import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  const csv = toCsv(
    ["Nom", "Catégorie", "Prix régulier (FCFA)", "Stock", "Seuil alerte", "Numéro", "Slug"],
    products.map((p) => [p.name, p.category, p.regularPrice ?? "", p.stock, p.lowStockThreshold, p.number ?? "", p.slug])
  );
  return csvResponse("produits-jamaal.csv", csv);
}
