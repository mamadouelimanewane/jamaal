import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { getSiteUrl } from "@/lib/site-url";

const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

/**
 * Catalogue produits au format « flux Meta » (Commerce Manager) pour alimenter le catalogue de
 * WhatsApp Business : id, titre, description, disponibilité, prix, lien, image, marque.
 */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const origin = await getSiteUrl();
  const products = await prisma.product.findMany({
    where: { regularPrice: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, shortDescription: true, regularPrice: true, stock: true, photo: true, category: true },
  });

  const header = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category"];
  const rows = products.map((p) =>
    [
      p.id,
      p.name.slice(0, 150),
      p.shortDescription.slice(0, 5000),
      p.stock > 0 ? "in stock" : "out of stock",
      "new",
      `${p.regularPrice} XOF`,
      `${origin}/produits/${p.slug}`,
      p.photo ?? "",
      "Chogan",
      p.category,
    ]
      .map(esc)
      .join(",")
  );

  return new Response("﻿" + [header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catalogue-whatsapp-jamaal.csv"',
    },
  });
}
