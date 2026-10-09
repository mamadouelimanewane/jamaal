import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { HomeCarousel } from "@/components/HomeCarousel";
import { AllRanges } from "@/components/AllRanges";
import { getHomeSlides, withResolvedImages } from "@/lib/home-carousel";
import { SearchBanner } from "@/components/SearchBanner";
import { CategorySection } from "@/components/CategorySection";
import { FragranceCollections } from "@/components/FragranceCollections";
import { InspiredBySection } from "@/components/InspiredBySection";
import { BlogSection } from "@/components/BlogSection";
import { getBestsellers } from "@/lib/db-products";

export const dynamic = "force-dynamic";

const otherUniverses = [
  { title: "Soins & beauté", note: "Visage · Corps · Cheveux", href: "/collections/soins-visage" },
  { title: "Huiles de soin", note: "Lolûm", href: "/collections/lolum" },
  { title: "Parfumer son intérieur", note: "JAMAAL Home", href: "/collections/parfum-ambiance" },
];

export default async function Home() {
  const [femme, homme, unisexe, slides] = await Promise.all([
    getBestsellers("parfum-femme", 4),
    getBestsellers("parfum-homme", 4),
    getBestsellers("parfum-unisexe", 4),
    getHomeSlides().then((all) => withResolvedImages(all.filter((s) => s.active))),
  ]);

  return <>
    <HomeCarousel slides={slides}/>
    <AllRanges/>

    <section aria-label="Les attentions JAMAAL" className="border-b border-[#eadfda] bg-[#fdfbfa]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-[#eadfda] px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
        <div className="flex items-center justify-center gap-3 py-4 sm:py-5"><Sparkles size={16} className="text-[#9c6254]"/><span className="text-[9px] uppercase tracking-[0.15em] text-navy/70">Revendeur officiel CHOGAN (Italie)</span></div>
        <div className="flex items-center justify-center gap-3 py-4 sm:py-5"><ShieldCheck size={16} className="text-[#9c6254]"/><span className="text-[9px] uppercase tracking-[0.15em] text-navy/70">Conseil parfum personnalisé</span></div>
        <div className="flex items-center justify-center gap-3 py-4 sm:py-5"><Truck size={16} className="text-[#9c6254]"/><span className="text-[9px] uppercase tracking-[0.15em] text-navy/70">Paiement Wave &amp; Orange Money</span></div>
      </div>
    </section>

    <SearchBanner/>
    <FragranceCollections products={[femme[0], homme[0], unisexe[0]]}/>

    <CategorySection title="Les signatures féminines" href="/collections/parfum-femme" products={femme}/>
    <CategorySection title="Les sillages masculins" href="/collections/parfum-homme" products={homme}/>
    {unisexe.length > 0 && <CategorySection title="L’art du parfum sans frontières" href="/collections/parfum-unisexe" products={unisexe}/>}

    <section className="bg-[#f2ede6] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-7 md:grid-cols-[1fr_auto] md:items-end">
        <div><p className="luxury-eyebrow">Le plaisir d’offrir</p><h2 className="mt-3 max-w-xl font-serif-display text-3xl font-medium leading-tight text-navy sm:text-4xl">Le premier chapitre d’une belle histoire olfactive.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-navy/65">Nos coffrets découverte réunissent des formats miniatures à offrir ou à garder près de soi.</p></div>
        <Link href="/coffrets-decouverte" className="inline-flex min-h-12 items-center justify-center gap-3 border border-navy px-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy transition hover:bg-navy hover:text-white">Découvrir les coffrets<ArrowRight size={15}/></Link>
      </div>
    </section>

    <InspiredBySection/>

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
      <div className="mb-7"><p className="luxury-eyebrow">Au-delà du parfum</p><h2 className="mt-3 font-serif-display text-3xl font-medium text-navy">L’univers JAMAAL</h2></div>
      <div className="grid gap-px bg-[#d9cbbd] sm:grid-cols-3">{otherUniverses.map((item, index) => <Link key={item.href} href={item.href} className="group flex min-h-36 flex-col justify-between bg-[#fdfbfa] p-6 transition hover:bg-white sm:p-8"><span className="text-[9px] uppercase tracking-[0.18em] text-[#9c6254]">0{index + 1} · JAMAAL</span><span className="mt-7 flex items-end justify-between gap-4"><span><span className="block font-serif-display text-xl text-navy">{item.title}</span><span className="mt-1 block text-xs text-navy/50">{item.note}</span></span><ArrowRight size={17} className="text-[#9c6254] transition-transform group-hover:translate-x-1"/></span></Link>)}</div>
    </section>

    <BlogSection/>
  </>;
}