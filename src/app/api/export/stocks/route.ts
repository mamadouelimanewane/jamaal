import { requireAdminForApi } from "@/lib/api-guard";
import { excelResponse } from "@/lib/excel";
import { getStockRows } from "@/lib/inventory-report";

const STATUS = { rupture: "Rupture", bas: "Stock bas", ok: "En stock" } as const;

/** État complet des stocks (une ligne par format), pour l'inventaire ou la commande Chogan. */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const rows = await getStockRows();
  const day = new Date().toISOString().slice(0, 10);
  return excelResponse(`stocks-jamaal-${day}.xlsx`, [
    {
      name: "Stocks",
      columns: [
        { header: "Produit", key: "name", width: 36 },
        { header: "Collection", key: "category", width: 18 },
        { header: "Code", key: "code", width: 12 },
        { header: "Format", key: "format", width: 16 },
        { header: "Stock", key: "stock", width: 9 },
        { header: "Seuil", key: "threshold", width: 9 },
        { header: "État", key: "status", width: 12 },
        { header: "Ventes 30 j", key: "sold30", width: 11 },
        { header: "Couverture (jours)", key: "coverage", width: 16 },
        { header: "À commander", key: "toOrder", width: 12 },
        { header: "Prix de vente (F)", key: "salePrice", width: 15 },
        { header: "Coût d'achat (F)", key: "unitCost", width: 15 },
        { header: "Valeur d'achat (F)", key: "costValue", width: 16 },
      ],
      rows: rows.map((r) => ({
        name: r.name,
        category: r.categoryLabel,
        code: r.code ?? "",
        format: r.format,
        stock: r.stock,
        threshold: r.threshold,
        status: STATUS[r.status],
        sold30: r.sold30,
        coverage: r.coverageDays ?? "",
        toOrder: r.toOrder,
        salePrice: r.salePrice ?? "",
        unitCost: r.unitCost ?? "",
        costValue: r.unitCost ? Math.max(0, r.stock) * r.unitCost : "",
      })),
    },
  ]);
}
