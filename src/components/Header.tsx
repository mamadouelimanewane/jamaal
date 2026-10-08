"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import type { Category } from "@/data/types";
import { useCartStore } from "@/lib/cart-store";

const subscribeNoop = () => () => {};

const FEATURED_CATEGORIES = ["parfum-femme", "parfum-homme", "parfum-unisexe"];

export function Header({ categories }: { categories: Category[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const count = useCartStore((state) => state.count());
  const openCart = useCartStore((state) => state.open);
  const perfumeCategories = categories.filter((category) => FEATURED_CATEGORIES.includes(category.slug));

  // Le panier vient du localStorage : on n'affiche le compteur qu'après l'hydratation.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // Grand logo en haut de page, réduit dès qu'on fait défiler pour ne pas gêner la lecture.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return <header className="sticky top-0 z-40 border-b border-[#eadfda] bg-[#fdfbfa]/95 backdrop-blur-md">
    <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 lg:px-12">
      <button type="button" className="justify-self-start rounded-full p-2 text-navy transition hover:bg-navy/5 lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      <Link href="/" aria-label="JAMAAL — accueil" className="col-start-2 row-start-1 flex flex-col items-center py-3 lg:col-start-1 lg:items-start lg:py-2">
        {/* Logo JAMAAL recadré sur le monogramme + nom (le JPG source a de larges marges) */}
        <span className={`relative block aspect-[540/605] overflow-hidden transition-all duration-300 ${scrolled ? "h-16 sm:h-20" : "h-28 sm:h-36"}`}>
          <Image
            src="/logo/jamaal-logo.jpg"
            alt="JAMAAL Luxury Cosmetics"
            width={720}
            height={1080}
            priority
            sizes="200px"
            className="absolute max-w-none h-[178%] w-auto -left-[19.5%] -top-[37%]"
          />
        </span>
      </Link>

      <nav aria-label="Navigation principale" className="hidden items-center justify-center gap-7 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex xl:gap-9">
        {perfumeCategories.map((category) => <Link key={category.slug} href={`/collections/${category.slug}`} className="nav-luxury-link">{category.navLabel.replace("JAMAAL ", "")}</Link>)}
        <Link href="/collections" className="nav-luxury-link">Toute la gamme</Link>
        <Link href="/coffrets-decouverte" className="nav-luxury-link">Coffrets</Link>
        <Link href="/espace-revendeur" className="nav-luxury-link">Espace consultant</Link>
        <Link href="/quiz" className="nav-luxury-link">Conseil parfum</Link>
      </nav>

      <div className="col-start-3 row-start-1 flex items-center justify-self-end gap-1 sm:gap-2">
        <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="Rechercher un parfum" aria-expanded={searchOpen} className="rounded-full p-2.5 text-navy/80 transition hover:bg-navy/5 hover:text-[#9c6254]"><Search size={18}/></button>
        <Link href="/compte" aria-label="Mon compte" className="hidden rounded-full p-2.5 text-navy/80 transition hover:bg-navy/5 hover:text-[#9c6254] sm:block"><UserRound size={18}/></Link>
        <button type="button" onClick={openCart} aria-label={`Ouvrir le panier${mounted && count ? `, ${count} article(s)` : ""}`} className="relative rounded-full p-2.5 text-navy/80 transition hover:bg-navy/5 hover:text-[#9c6254]"><ShoppingBag size={18}/>{mounted && count > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1d2f4f] px-1 text-[9px] font-semibold text-white">{count}</span>}</button>
      </div>
    </div>

    {searchOpen && <form onSubmit={submitSearch} role="search" className="border-t border-[#eadfda] bg-[#f5f0e9] px-4 py-4 sm:px-8"><div className="mx-auto flex max-w-2xl items-center gap-3 border-b border-[#c9a99e] pb-2"><Search size={17} className="shrink-0 text-[#9c6254]"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} type="search" aria-label="Rechercher un parfum" placeholder="Nom, numéro ou note olfactive" className="w-full bg-transparent py-2 text-sm text-navy outline-none placeholder:text-navy/45"/><button type="submit" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-navy">Chercher<ArrowRight size={14}/></button></div></form>}

    {menuOpen && <nav aria-label="Menu mobile" className="border-t border-[#eadfda] bg-[#fdfbfa] px-5 py-4 lg:hidden"><div className="flex flex-col"><Link href="/collections" onClick={closeMenu} className="border-b border-[#eadfda] py-3 font-serif-display text-lg text-navy">Toute la gamme</Link>{perfumeCategories.map((category) => <Link key={category.slug} href={`/collections/${category.slug}`} onClick={closeMenu} className="border-b border-[#eadfda] py-3 font-serif-display text-lg text-navy">{category.navLabel.replace("JAMAAL ", "")}</Link>)}<Link href="/coffrets-decouverte" onClick={closeMenu} className="border-b border-[#eadfda] py-3 font-serif-display text-lg text-navy">Coffrets découverte</Link><Link href="/quiz" onClick={closeMenu} className="border-b border-[#eadfda] py-3 font-serif-display text-lg text-navy">Trouver mon parfum</Link><Link href="/espace-revendeur" onClick={closeMenu} className="border-b border-[#eadfda] py-3 font-serif-display text-lg text-navy">Espace consultant</Link><Link href="/devenir-consultant" onClick={closeMenu} className="py-3 text-xs uppercase tracking-widest text-navy/60">Devenir consultant JAMAAL</Link></div></nav>}
  </header>;
}