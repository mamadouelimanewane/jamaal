import Link from "next/link";
import { getProductsByCategory } from "@/lib/db-products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function DiscoverySetsPage() {
  const catalog = await getProductsByCategory("autres-produits");
  const sets = catalog.filter((product) => product.name.toLocaleLowerCase("fr").includes("coffret") || product.slug.toLocaleLowerCase().includes("coffret"));
  return <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-dark">Le rituel JAMAAL</p>
    <h1 className="mt-3 font-serif-display text-3xl font-semibold text-navy sm:text-4xl">Coffrets découverte</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-navy/70">Explorez plusieurs sillages JAMAAL grâce aux coffrets miniatures disponibles au catalogue. Une belle façon de trouver votre signature ou de faire un cadeau parfumé.</p>
    {sets.length ? <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{sets.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <div className="mt-9 rounded-2xl border border-line bg-white p-7"><p className="text-sm text-navy/70">Les coffrets sont momentanément indisponibles. Découvrez les collections parfum en attendant.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/collections/parfum-femme" className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Parfums femme</Link><Link href="/collections/parfum-homme" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-navy">Parfums homme</Link></div></div>}
  </div>;
}
