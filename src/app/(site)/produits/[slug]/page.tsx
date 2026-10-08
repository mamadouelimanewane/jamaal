import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getProductBySlug, getProductsByCategory } from "@/lib/db-products";
import { getCategory } from "@/lib/db-categories";
import { ProductVisual } from "@/components/ProductVisual";
import { StarRating } from "@/components/StarRating";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { ShareWhatsApp } from "@/components/ShareWhatsApp";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

// Une seule requête base pour la page et ses métadonnées.
const loadProduct = cache(getProductBySlug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Produit introuvable", robots: { index: false } };
  const description = product.shortDescription.slice(0, 180);
  const priceText = product.regularPrice ? ` — ${product.regularPrice.toLocaleString("fr-FR")} FCFA` : "";
  const image = product.photo ?? "/logo/jamaal-logo.jpg";
  return {
    title: product.name,
    description,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: {
      type: "website",
      url: `/produits/${product.slug}`,
      title: `${product.name}${priceText}`,
      description,
      images: [{ url: image, alt: product.name }],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();
  const category = await getCategory(product.category);
  const related = (await getProductsByCategory(product.category)).filter((item) => item.id !== product.id).slice(0, 4);

  return <main className="mx-auto max-w-[1440px] px-5 pb-20 pt-6 sm:px-8 lg:px-12">
    <nav aria-label="Fil d’Ariane" className="mb-7 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-navy/45"><Link href="/" className="transition hover:text-navy">Accueil</Link><span>/</span><Link href={`/collections/${product.category}`} className="transition hover:text-navy">{category?.label || "Parfums"}</Link><span>/</span><span className="max-w-48 truncate text-navy/75">{product.name}</span></nav>

    <div className="grid gap-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 xl:gap-24">
      <div className="relative self-start bg-[#f5ece8] lg:sticky lg:top-28">
        <div className="relative aspect-[4/4.5] w-full overflow-hidden"><ProductVisual product={product} fit="contain" className="h-full w-full p-5 sm:p-10 lg:p-14" sizes="(max-width: 1024px) 100vw, 54vw"/></div>
        <div className="absolute bottom-4 left-4 bg-[#fdfbfa]/90 px-3 py-2 text-[8px] uppercase tracking-[0.17em] text-navy/70 backdrop-blur sm:bottom-6 sm:left-6">JAMAAL · Extrait de parfum</div>
      </div>

      <div className="lg:py-6 xl:py-10">
        <div className="max-w-xl">
          <p className="luxury-eyebrow">{product.family || "La collection JAMAAL"}</p>
          <h1 className="mt-3 font-serif-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[#14213b] sm:text-4xl xl:text-5xl">{product.name}</h1>
          {product.choganCode || product.number ? (
            <p className="mt-2 text-sm text-navy/65">
              {product.choganCode ? <>Code Chogan <span className="font-semibold text-navy">{product.choganCode}</span></> : null}
              {product.choganCode && product.number ? " · " : null}
              {product.number ? <>N° de fiche {product.number}</> : null}
            </p>
          ) : null}
          {product.reviewCount > 0 && <div className="mt-3"><StarRating rating={product.rating} count={product.reviewCount}/></div>}
          <p className="mt-5 text-sm leading-7 text-navy/65">{product.shortDescription}</p>
          <div className="my-7 border-t border-[#eadfda]"/>
          <ProductPurchasePanel product={product}/>
          <ShareWhatsApp name={product.name} slug={product.slug} price={product.regularPrice ?? null}/>
          <div className="mt-6 grid grid-cols-2 gap-3 border-y border-[#eadfda] py-4 text-[9px] uppercase tracking-[0.12em] text-navy/60"><span>Extrait concentré à 30 %</span><span className="text-right">Paiement Wave · Orange Money</span></div>

          {(product.topNotes?.length || product.heartNotes?.length || product.baseNotes?.length) ? <section className="mt-9"><p className="luxury-eyebrow">Pyramide olfactive</p><div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">{[{ label: "Tête", notes: product.topNotes }, { label: "Cœur", notes: product.heartNotes }, { label: "Fond", notes: product.baseNotes }].map((level) => <div key={level.label} className="border-t border-[#c9a99e] pt-3"><p className="text-[8px] uppercase tracking-[0.2em] text-[#9c6254]">{level.label}</p><p className="mt-2 text-[11px] leading-5 text-navy sm:text-xs">{level.notes?.join(", ") || "—"}</p></div>)}</div></section> : null}

          <details className="group mt-8 border-y border-[#eadfda] py-4"><summary className="flex cursor-pointer list-none items-center justify-between font-serif-display text-base text-navy">L’histoire de cette fragrance <span className="text-xl transition group-open:rotate-45">+</span></summary><div className="pt-4 text-sm leading-7 text-navy/65">{product.longDescription.map((paragraph, index) => <p key={index} className="mb-3 last:mb-0">{paragraph}</p>)}</div></details>
        </div>
      </div>
    </div>

    {related.length > 0 && <section className="mt-20 border-t border-[#eadfda] pt-10 sm:mt-28"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="luxury-eyebrow">Continuer la découverte</p><h2 className="mt-2 font-serif-display text-2xl text-navy sm:text-3xl">Dans le même sillage</h2></div><Link href={`/collections/${product.category}`} className="editorial-link">Toute la collection <ArrowRight size={14}/></Link></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">{related.map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>}
    <Link href={`/collections/${product.category}`} className="mt-12 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy/60 transition hover:text-navy"><ArrowLeft size={14}/> Retour à la collection</Link>
  </main>;
}