import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getReseller, resellerLinks } from "@/lib/reseller";
import { mySellerRate, startingPrice } from "@/lib/reseller-catalog";
import { getCategories } from "@/lib/db-categories";
import { estimatedGainLabel } from "@/lib/share-text";
import { ShareStudio } from "@/components/admin/ShareStudio";

export const dynamic = "force-dynamic";

export default async function CatalogueProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { slug: true, name: true, photo: true, gallery: true, choganCode: true, inspiredBy: true, inspiredBrand: true, category: true, family: true, topNotes: true, heartNotes: true, baseNotes: true, shortDescription: true, longDescription: true, regularPrice: true, volumes: true },
  });
  if (!product) notFound();
  const me = await getReseller();
  const [links, rate, categories] = await Promise.all([resellerLinks(me?.slug ?? null), me ? mySellerRate(me.id) : Promise.resolve(null), getCategories()]);
  const category = categories.find((c) => c.slug === product.category);
  const volumes = ((product.volumes as { label?: string; price?: number }[] | null) ?? []).filter((v) => v.label && (v.price ?? 0) > 0) as { label: string; price: number }[];
  const price = startingPrice(product.regularPrice, product.volumes);
  const photos = [product.photo, ...product.gallery].filter((p): p is string => !!p).slice(0, 6);
  const notes = [
    ["Tête", product.topNotes],
    ["Cœur", product.heartNotes],
    ["Fond", product.baseNotes],
  ].filter(([, n]) => (n as string[]).length) as [string, string[]][];

  return (
    <div className="max-w-6xl">
      <Link href="/admin/catalogue" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/75 hover:text-navy"><ArrowLeft size={15} /> Tous les produits</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-white">
            {photos[0] ? <Image src={photos[0]} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-contain p-4" priority /> : <div className="h-full" style={{ background: "linear-gradient(135deg,#16233a,#c9997a)" }} />}
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.slice(1).map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
                  <Image src={src} alt="" fill sizes="80px" className="object-contain p-1" />
                </a>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">{[category?.label ?? product.category, product.choganCode && `Code ${product.choganCode}`].filter(Boolean).join(" · ")}</p>
            <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">{product.name}</h1>
            {product.inspiredBy && <p className="mt-1 text-sm text-rose-dark">Inspiré de {product.inspiredBy}{product.inspiredBrand ? ` (${product.inspiredBrand})` : ""}</p>}
            {price != null && (
              <p className="mt-3 text-lg font-semibold text-navy">
                {volumes.length > 1 ? "À partir de " : ""}{price.toLocaleString("fr-FR")} FCFA
                {rate !== null && <span className="ml-2 text-sm font-semibold text-emerald-700">{estimatedGainLabel(price, rate)}</span>}
              </p>
            )}
            {volumes.length > 1 && (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
                {volumes.map((v) => (
                  <li key={v.label} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex items-center gap-2 text-navy"><Layers size={14} className="text-navy/50" /> {v.label}</span>
                    <span className="text-right">
                      <span className="font-semibold text-navy">{v.price.toLocaleString("fr-FR")} F</span>
                      {rate !== null && <span className="block text-xs text-emerald-700">{estimatedGainLabel(v.price, rate)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {product.shortDescription && <p className="mt-4 text-sm leading-relaxed text-navy/85">{product.shortDescription}</p>}
            {notes.length > 0 && (
              <dl className="mt-4 grid gap-1.5 text-sm">
                {product.family && (<><dt className="sr-only">Famille</dt><dd className="text-navy/80"><strong className="text-navy">Famille :</strong> {product.family}</dd></>)}
                {notes.map(([label, list]) => (
                  <dd key={label} className="text-navy/80"><strong className="text-navy">Notes de {label.toLowerCase()} :</strong> {list.join(", ")}</dd>
                ))}
              </dl>
            )}
            <a href={links.productLink(product.slug)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-dark hover:underline">
              Voir la page client <ExternalLink size={14} />
            </a>
          </div>
        </section>

        <section id="partager" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif-display text-xl font-semibold text-navy">Lancer le marketing</h2>
              <p className="mt-1 text-sm text-navy/75">Choisissez l&apos;image, puis envoyez-la sur WhatsApp (client ou statut), sur TikTok, ou enregistrez-la dans votre galerie.</p>
            </div>
            <Link href={`/admin/mon-marketing?produits=${product.slug}#partager`} className="rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-navy hover:bg-cream">+ Ajouter d&apos;autres produits</Link>
          </div>
          <div className="mt-5">
            <ShareStudio items={[{ slug: product.slug, name: product.name, price, choganCode: product.choganCode, inspiredBy: product.inspiredBy }]} origin={links.origin} refSlug={me?.slug ?? null} />
          </div>
        </section>
      </div>
    </div>
  );
}
