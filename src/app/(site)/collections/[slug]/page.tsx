import { getT } from "@/lib/i18n/server";
import Link from "@/components/i18n/Link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCategory } from "@/lib/db-categories";
import { getProductsByCategory } from "@/lib/db-products";
import { CollectionGrid } from "@/components/CollectionGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, t] = await Promise.all([getCategory(slug).catch(() => null), getT()]);
  if (!category) return { title: t("Collection introuvable") };
  return { title: category.label, description: (category.description || t("Découvrez la collection {label} de JAMAAL, revendeur officiel Chogan au Sénégal.", { label: category.label })).slice(0, 160) };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getT();
  const { slug } = await params;
  const [category, products] = await Promise.all([getCategory(slug), getProductsByCategory(slug)]);
  if (!category) notFound();
  const isPerfume = slug.startsWith("parfum-");
  return <main className="min-h-[70vh]">
    <section className="bg-[#f5ece8] px-5 py-11 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <nav aria-label={t("Fil d’Ariane")} className="mb-7 text-[9px] uppercase tracking-[0.14em] text-navy/45"><Link href="/" className="hover:text-navy">{t("Accueil")}</Link><span className="mx-2">/</span><span className="text-navy/75">{t(category.label)}</span></nav>
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end"><div><p className="luxury-eyebrow">{isPerfume ? t("Les fragrances JAMAAL") : t("Les collections JAMAAL")}</p><h1 className="mt-3 max-w-3xl font-serif-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[#14213b] sm:text-5xl">{t(category.label)}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-navy/60">{t(category.description)}</p></div><Link href="/parfum-adn" className="editorial-link w-fit">{t("Conseil personnalisé")} <ArrowRight size={14}/></Link></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:px-12 lg:py-14"><CollectionGrid products={products}/></section>
  </main>;
}