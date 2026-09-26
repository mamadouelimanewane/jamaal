import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, categories } from "@/data/categories";
import { getProductsByCategory } from "@/data/products";
import { CollectionGrid } from "@/components/CollectionGrid";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const products = getProductsByCategory(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="mb-2 text-xs text-navy/50">
        <Link href="/">Accueil</Link> / {category.label}
      </p>
      <h1 className="font-serif-display text-3xl font-semibold text-navy">{category.label}</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/70">{category.description}</p>

      <div className="mt-8">
        <CollectionGrid products={products} />
      </div>
    </div>
  );
}
