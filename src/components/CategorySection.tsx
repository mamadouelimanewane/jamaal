import { getT } from "@/lib/i18n/server";
import Link from "@/components/i18n/Link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/data/types";
import { ProductCard } from "./ProductCard";

export async function CategorySection({ title, href, products }: { title: string; href: string; products: Product[] }) {
  const t = await getT();
  if (!products.length) return null;
  return <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#eadfda] pb-5">
      <div><p className="luxury-eyebrow">{t("La collection JAMAAL")}</p><h2 className="mt-2 font-serif-display text-2xl font-medium text-navy sm:text-3xl">{t(title)}</h2></div>
      <Link href={href} className="editorial-link">{t("Voir la collection")} <ArrowRight size={15}/></Link>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
  </section>;
}