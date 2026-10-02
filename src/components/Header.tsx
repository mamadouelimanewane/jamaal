"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import type { Category } from "@/data/types";
import { useCartStore } from "@/lib/cart-store";

const FEATURED_CATEGORIES = ["parfum-femme", "parfum-homme", "parfum-unisexe"];

export function Header({ categories }: { categories: Category[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const count = useCartStore((state) => state.count());
  const openCart = useCartStore((state) => state.open);
  const perfumeCategories = categories.filter((category) => FEATURED_CATEGORIES.includes(category.slug));

  useEffect(() => setMounted(true), []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return <header className="sticky top-0 z-40 border-b border-[#e8e0d7] bg-[#fbf9f5]/95 backdrop-blur-md">
    <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 lg:px-12">
      <button type="button" className="justify-self-start rounded-full p-2 text-navy transition hover:bg-navy/5 lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      <Link href="/" aria-label="JAMAAL — accueil" className="col-start-2 row-start-1 flex flex-col items-center py-3 lg:col-start-1 lg:items-start lg:py-2">
        <span className="font-serif-display text-[22px] font-medium tracking-[0.26em] text-[#241915] sm:text-2xl">JAMAAL</span>
        <span className="mt-0.5 text-[7px] font-medium uppercase tracking-[0.36em] text-[#9a755d] sm:text-[8px]">Maison de parfum</span>
      </Link>

      <nav aria-label="Navigation principale" className="hidden items-center justify-center gap-7 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex xl:gap-9">
        {perfumeCategories.map((category) => <Link key={category.slug} href={`/collections/${category.slug}`} className="nav-luxury-link">{category.navLabel.replace("JAMAAL ", "")}</Link>)}
        <Link href="/collections" className="nav-luxury-link">Toute la gamme</Link>
        <Link href="/coffrets-decouverte" className="nav-luxury-link">Coffrets</Link>
        <Link href="/espace-revendeur" className="nav-luxury-link">Espace revendeur</Link>
        <Link href="/quiz" className="nav-luxury-link">Conseil parfum</Link>
      </nav>

      <div className="col-start-3 row-start-1 flex items-center justify-self-end gap-1 sm:gap-2">
        <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="Rechercher un parfum" aria-expanded={searchOpen} className="rounded-full p-2.5 text-navy/80 transition hover:bg-navy/5 hover:text-[#9a755d]"><Search size={18}/></button>
        <Link href="/compte" aria-label="Mon compte" className="hidden rounded-full p-2.5 text-navy/80 transition hover:bg-navy/5 hover:text-[#9a755d] sm:block"><UserRound size={18}/></Link>
        <button type="button" onClick={openCart} aria-label={`Ouvrir le panier${mounted && count ? `, ${count} article(s)` : ""}`} className="relative rounded-full p-2.5 text-navy/80 transition hover:bg-navy/5 hover:text-[#9a755d]"><ShoppingBag size={18}/>{mounted && count > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7b2938] px-1 text-[9px] font-semibold text-white">{count}</span>}</button>
      </div>
    </div>

    {searchOpen && <form onSubmit={submitSearch} role="search" className="border-t border-[#e8e0d7] bg-[#f5f0e9] px-4 py-4 sm:px-8"><div className="mx-auto flex max-w-2xl items-center gap-3 border-b border-[#bca996] pb-2"><Search size={17} className="shrink-0 text-[#9a755d]"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} type="search" aria-label="Rechercher un parfum" placeholder="Nom, numéro ou note olfactive" className="w-full bg-transparent py-2 text-sm text-navy outline-none placeholder:text-navy/45"/><button type="submit" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-navy">Chercher<ArrowRight size={14}/></button></div></form>}

    {menuOpen && <nav aria-label="Menu mobile" className="border-t border-[#e8e0d7] bg-[#fbf9f5] px-5 py-4 lg:hidden"><div className="flex flex-col"><Link href="/collections" onClick={closeMenu} className="border-b border-[#e8e0d7] py-3 font-serif-display text-lg text-navy">Toute la gamme</Link>{perfumeCategories.map((category) => <Link key={category.slug} href={`/collections/${category.slug}`} onClick={closeMenu} className="border-b border-[#e8e0d7] py-3 font-serif-display text-lg text-navy">{category.navLabel.replace("JAMAAL ", "")}</Link>)}<Link href="/coffrets-decouverte" onClick={closeMenu} className="border-b border-[#e8e0d7] py-3 font-serif-display text-lg text-navy">Coffrets découverte</Link><Link href="/quiz" onClick={closeMenu} className="border-b border-[#e8e0d7] py-3 font-serif-display text-lg text-navy">Trouver mon parfum</Link><Link href="/espace-revendeur" onClick={closeMenu} className="border-b border-[#eadfda] py-3 font-serif-display text-lg text-navy">Espace revendeur</Link><Link href="/devenir-consultant" onClick={closeMenu} className="py-3 text-xs uppercase tracking-widest text-navy/60">Devenir consultant JAMAAL</Link></div></nav>}
  </header>;
}