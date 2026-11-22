import { prisma } from "@/lib/prisma";
import { siteBaseUrl } from "@/lib/site-url";
import { isUnsoldFormat, startingPrice } from "@/lib/price-from";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const xml = (s: string) => s.replace(/[<>&'\"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[c]!);

/** Flux produits RSS/XML compatible avec le catalogue Meta Commerce Manager. */
export async function GET() {
  const base = siteBaseUrl();
  const products = await prisma.product.findMany({
    where: { isOfficial: true },
    select: { id: true, slug: true, name: true, shortDescription: true, category: true, regularPrice: true, publicPrice: true, volumes: true, stock: true, photo: true, variants: { select: { stock: true, volumeLabel: true } } },
    orderBy: { name: "asc" },
  });
  // Prix = prix « à partir de » du site (plus petit format vendu, pas de 15 ml) ; identifiant = celui du pixel.
  const items = products.filter((p) => (startingPrice(p.regularPrice ?? p.publicPrice, p.volumes) ?? 0) > 0).map((p) => {
    const price = startingPrice(p.regularPrice ?? p.publicPrice, p.volumes)!;
    const image = p.photo?.startsWith("http") ? p.photo : p.photo ? `${base}${p.photo.startsWith("/") ? "" : "/"}${p.photo}` : `${base}/logo/jamaal-logo.jpg`;
    const sold = p.variants.filter((v) => !isUnsoldFormat(v.volumeLabel));
    const variants = sold.length ? sold : p.variants;
    const available = variants.length ? variants.some((v) => v.stock > 0) : p.stock > 0;
    return `<item><g:id>${xml(p.id)}</g:id><g:title>${xml(p.name)}</g:title><g:description>${xml(p.shortDescription || p.name)}</g:description><g:availability>${available ? "in stock" : "out of stock"}</g:availability><g:condition>new</g:condition><g:price>${price} XOF</g:price><g:link>${xml(`${base}/produits/${p.slug}`)}</g:link><g:image_link>${xml(image)}</g:image_link><g:brand>JAMAAL</g:brand><g:product_type>${xml(p.category)}</g:product_type></item>`;
  }).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Catalogue JAMAAL</title><link>${xml(base)}</link><description>Produits JAMAAL</description>${items}</channel></rss>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
