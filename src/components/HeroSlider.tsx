"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import type { Product } from "@/data/types";

export function HeroSlider({ featuredProduct }: { featuredProduct?: Product | null }) {
  const image = featuredProduct?.photo || "/produits/jamaal-scented-love-25.jpg";
  const productHref = featuredProduct ? `/produits/${featuredProduct.slug}` : "/collections/parfum-femme";
  return <section className="relative isolate overflow-hidden bg-[#141f42] text-[#fbf7f0]">
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_50%,rgba(152,101,72,0.22),transparent_52%),linear-gradient(120deg,#141f42_0%,#30221d_55%,#46322a_100%)]"/>
    <div className="mx-auto grid min-h-[650px] max-w-[1600px] lg:min-h-[700px] lg:grid-cols-[0.92fr_1.08fr]">
      <div className="relative z-10 flex flex-col justify-center px-6 pb-10 pt-14 sm:px-10 lg:px-16 xl:px-24">
        <p className="luxury-eyebrow text-[#d9a99a]">La maison JAMAAL</p>
        <h1 className="mt-6 max-w-2xl font-serif-display text-[3.25rem] font-normal leading-[1.04] tracking-[-0.035em] sm:text-6xl xl:text-[5.4rem]">Le parfum d’une <em className="font-normal text-[#d9a99a]">présence.</em></h1>
        <p className="mt-6 max-w-lg text-sm leading-7 text-white/70 sm:text-base sm:leading-8">Des extraits de parfum intenses, pensés pour celles et ceux qui laissent une empreinte. Découvrez le sillage qui vous ressemble.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/collections/parfum-femme" className="inline-flex min-h-12 items-center justify-center gap-3 bg-[#d9a99a] px-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#141f42] transition hover:bg-[#f6eee1]">Explorer les parfums <ArrowRight size={15}/></Link>
          <Link href="/quiz" className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/30 px-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:border-white hover:bg-white/5">Trouver ma fragrance</Link>
        </div>
        <div className="mt-12 flex items-center gap-4 border-t border-white/15 pt-5">
          <span className="font-serif-display text-3xl text-[#d9a99a]">30%</span><span className="max-w-[220px] text-[10px] uppercase leading-5 tracking-[0.17em] text-white/55">Concentration d’extrait · une signature qui dure</span>
        </div>
      </div>
      <Link href={productHref} aria-label={featuredProduct ? `Découvrir ${featuredProduct.name}` : "Découvrir la collection JAMAAL"} className="group relative mx-4 mb-5 min-h-[340px] overflow-hidden sm:mx-8 lg:mx-0 lg:mb-0 lg:min-h-full">
        <Image src={image} alt={featuredProduct?.name || "Flacon de parfum JAMAAL Scented Love"} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover object-center transition duration-1000 group-hover:scale-[1.025]"/>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1511]/55 via-transparent to-transparent"/>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white sm:p-9">
          <div><p className="text-[10px] uppercase tracking-[0.22em] text-white/75">La signature du moment</p><p className="mt-2 font-serif-display text-2xl sm:text-3xl">{featuredProduct?.name || "Scented Love N°25"}</p></div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/60 transition group-hover:bg-white group-hover:text-navy"><ArrowDownRight size={19}/></span>
        </div>
      </Link>
    </div>
  </section>;
}