import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Product } from "@/data/types";
import { ProductVisual } from "./ProductVisual";

const collections = [
  { title: "Parfums femme", subtitle: "Floraux · lumineux · sensuels", href: "/collections/parfum-femme", accent: "from-[#b47a6c]/75" },
  { title: "Parfums homme", subtitle: "Boisés · intenses · élégants", href: "/collections/parfum-homme", accent: "from-[#182536]/80" },
  { title: "Parfums unisexes", subtitle: "Des sillages libres", href: "/collections/parfum-unisexe", accent: "from-[#3a4f73]/75" },
];

export function FragranceCollections({ products }: { products: (Product | undefined)[] }) {
  return <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="luxury-eyebrow">Choisissez votre univers</p><h2 className="mt-3 font-serif-display text-3xl font-medium text-navy sm:text-4xl">Une fragrance, une présence.</h2></div>
      <Link href="/quiz" className="editorial-link">Le conseil parfum <ArrowRight size={15}/></Link>
    </div>
    <div className="grid gap-4 md:grid-cols-3 md:gap-5">
      {collections.map((collection, index) => {
        const product = products[index];
        return <Link key={collection.href} href={collection.href} className="group relative isolate min-h-[360px] overflow-hidden bg-[#e9e2d8] sm:min-h-[430px]">
          {product ? <ProductVisual product={product} fit="cover" className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-[1.04]" sizes="(max-width: 768px) 100vw, 33vw"/> : <div className="absolute inset-0 bg-gradient-to-br from-[#14213b] to-[#6b7391]"/>}
          <div aria-hidden="true" className={`absolute inset-0 -z-0 bg-gradient-to-t ${collection.accent} via-transparent to-transparent opacity-95`}/>
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/75">JAMAAL · EXTRAIT DE PARFUM</p>
            <h3 className="mt-2 font-serif-display text-2xl font-medium sm:text-3xl">{collection.title}</h3>
            <div className="mt-3 flex items-center justify-between text-xs text-white/80"><span>{collection.subtitle}</span><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/50 transition group-hover:bg-white group-hover:text-navy"><ArrowRight size={16}/></span></div>
          </div>
        </Link>;
      })}
    </div>
  </section>;
}