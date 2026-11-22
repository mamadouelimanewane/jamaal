import { prisma } from "@/lib/prisma";
import { siteBaseUrl } from "@/lib/site-url";
import { isUnsoldFormat, startingPrice } from "@/lib/price-from";
import { catalogProductLink, cleanRef } from "@/lib/meta-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const xml = (s: string) => s.replace(/[<>&'\"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[c]!);

/**
 * Flux produits RSS/XML compatible avec le catalogue Meta Commerce Manager.
 * ?ref=<code revendeur> : catalogue personnel du revendeur, dont chaque lien porte son code (vente attribuée).
 */
export async function GET(request: Request) {
  const base = siteBaseUrl();
  const asked = cleanRef(new URL(request.url).searchParams.get("ref"));
  // Code inconnu ou revendeur inactif : catalogue JAMAAL normal.
  const ref = asked ? ((await prisma.consultant.findFirst({ where: { slug: asked, active: true }, select: { slug: true } }).catch(() => null))?.slug ?? null) : null;
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
    return `<item><g:id>${xml(p.id)}</g:id><g:title>${xml(p.name)}</g:title><g:description>${xml(p.shortDescription || p.name)}</g:description><g:availability>${available ? "in stock" : "out of stock"}</g:availability><g:condition>new</g:condition><g:price>${price} XOF</g:price><g:link>${xml(catalogProductLink(base, p.slug, ref))}</g:link><g:image_link>${xml(image)}</g:image_link><g:brand>JAMAAL</g:brand><g:product_type>${xml(p.category)}</g:product_type></item>`;
  }).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Catalogue JAMAAL${ref ? ` · ${xml(ref)}` : ""}</title><link>${xml(base)}</link><description>Produits JAMAAL</description>${items}</channel></rss>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
