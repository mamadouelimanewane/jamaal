import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/search-index";

/** Suggestions instantanées de la barre de recherche. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ query: "", corrected: null, total: 0, products: [], brands: [], categories: [] });
  const r = await searchCatalog(q, 40);
  return NextResponse.json(
    {
      query: r.query,
      corrected: r.corrected,
      total: r.total,
      products: r.hits.slice(0, 7).map(({ doc }) => ({
        slug: doc.slug,
        name: doc.name,
        code: doc.choganCode,
        number: doc.number,
        inspiredBy: doc.inspiredBy,
        inspiredBrand: doc.inspiredBrand,
        category: doc.categoryLabel,
        price: doc.price,
        photo: doc.photo,
        colorFrom: doc.colorFrom,
        colorTo: doc.colorTo,
      })),
      brands: r.brands.slice(0, 6),
      categories: r.categories.slice(0, 4),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
