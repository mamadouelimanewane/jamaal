/**
 * Catalogue WhatsApp (Meta Commerce) : flux CSV des produits, une ligne par format, et lecture
 * des paniers envoyés depuis le catalogue dans WhatsApp. L'identifiant d'une ligne est
 * « <id produit>-v<n° du format> » (ou l'id seul pour un produit sans formats).
 */
import { prisma } from "@/lib/prisma";
import { UNIQUE_FORMAT } from "@/lib/stock";

export function catalogItemId(productId: string, volumeIndex: number | null): string {
  return volumeIndex == null ? productId : `${productId}-v${volumeIndex}`;
}

export function parseCatalogItemId(retailerId: string): { productId: string; volumeIndex: number | null } {
  const m = retailerId.match(/^(.+)-v(\d{1,2})$/);
  return m ? { productId: m[1], volumeIndex: Number(m[2]) } : { productId: retailerId, volumeIndex: null };
}

const csvCell = (v: string | number) => {
  const s = String(v).replace(/\s+/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type FeedProduct = { id: string; name: string; slug: string; shortDescription: string; photo: string | null; stock: number; regularPrice: number | null; volumes: unknown };

/** Flux CSV au format Meta (pur, testé). Les produits sans photo ni prix sont ignorés. */
export function buildCatalogCsv(products: FeedProduct[], site: string): string {
  const head = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"];
  const rows: string[] = [head.join(",")];
  for (const p of products) {
    if (!p.photo) continue;
    const image = p.photo.startsWith("http") ? p.photo : `${site}${p.photo}`;
    const volumes = ((p.volumes as { label: string; price: number }[] | null) ?? []).filter((v) => v?.label && v.price > 0);
    const lines = volumes.length ? volumes.map((v, i) => ({ id: catalogItemId(p.id, i), label: v.label, price: v.price })) : p.regularPrice ? [{ id: catalogItemId(p.id, null), label: UNIQUE_FORMAT, price: p.regularPrice }] : [];
    for (const l of lines) {
      rows.push(
        [
          l.id,
          volumes.length > 1 ? `${p.name} ${l.label}` : p.name,
          (p.shortDescription || p.name).slice(0, 4900),
          p.stock > 0 ? "in stock" : "available for order",
          "new",
          `${l.price} XOF`,
          `${site}/produits/${p.slug}`,
          image,
          "JAMAAL · Chogan",
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }
  return rows.join("\n") + "\n";
}

export async function catalogCsv(site: string): Promise<string> {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, shortDescription: true, photo: true, stock: true, regularPrice: true, volumes: true },
    orderBy: { name: "asc" },
  });
  return buildCatalogCsv(products, site);
}

/** Panier envoyé depuis le catalogue WhatsApp → texte lisible pour l'assistant. */
export async function describeCatalogOrder(items: { retailerId: string; quantity: number }[]): Promise<string> {
  const lines: string[] = [];
  for (const it of items.slice(0, 15)) {
    const { productId, volumeIndex } = parseCatalogItemId(it.retailerId);
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, volumes: true } });
    if (!p) continue;
    const volumes = (p.volumes as { label: string }[] | null) ?? [];
    const label = volumeIndex != null ? volumes[volumeIndex]?.label : null;
    lines.push(`${Math.max(1, Math.min(20, it.quantity))} × ${p.name}${label ? ` (${label})` : ""}`);
  }
  return lines.length ? `[panier] J'ai choisi dans le catalogue WhatsApp : ${lines.join(", ")}. Je veux commander.` : "[panier] (articles du catalogue introuvables)";
}
