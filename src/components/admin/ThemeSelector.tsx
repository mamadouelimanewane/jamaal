"use client";

import { useState } from "react";
import { Check, Palette, Moon, Sun, ShoppingBag } from "lucide-react";
import { SHOP_THEMES, DEFAULT_THEME_ID, type ShopThemeId, getShopTheme } from "@/lib/shop/themes";
import type { PickerProduct } from "./GrowthWidgets";

interface ThemeSelectorProps {
  initialTheme: string | null | undefined;
  consultantName: string;
  avatarUrl: string | null;
  tagline: string;
  bio: string;
  products: PickerProduct[];
  favorites: string[];
}

export function ThemeSelector({ initialTheme, consultantName, avatarUrl, tagline, bio, products, favorites }: ThemeSelectorProps) {
  const [selectedId, setSelectedId] = useState<ShopThemeId>(
    initialTheme && SHOP_THEMES.some((theme) => theme.id === initialTheme)
      ? initialTheme as ShopThemeId
      : DEFAULT_THEME_ID
  );
  const theme = getShopTheme(selectedId);
  const initials = consultantName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  const showcase = (favorites.map((id) => products.find((product) => product.id === id)).filter(Boolean) as PickerProduct[]).slice(0, 3);
  const previewProducts = (showcase.length ? showcase : products.slice(0, 3));

  return (
    <div className="space-y-5">
      <input type="hidden" name="theme" value={selectedId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Palette size={16} className="text-rose-dark" /> Apparence de ma boutique
          </label>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-navy/60">
            Choisissez une palette. Votre photo, votre slogan, votre présentation et vos coups de cœur personnalisent ensuite la page.
          </p>
        </div>
        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-navy/70">{SHOP_THEMES.length} styles</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_THEMES.map((option) => {
          const active = option.id === selectedId;
          return (
            <button key={option.id} type="button" aria-pressed={active} onClick={() => setSelectedId(option.id)}
              className={`overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy ${active ? "border-navy ring-2 ring-navy/10" : "border-line hover:border-navy/40"}`}>
              <div className="h-12" style={{ background: `linear-gradient(105deg, ${option.palette.background} 0 58%, ${option.palette.accent} 58% 73%, ${option.palette.primary} 73%)` }} />
              <div className="flex items-start justify-between gap-2 p-3">
                <div>
                  <span className="block text-sm font-semibold text-navy">{option.name}</span>
                  <span className="mt-0.5 block text-xs text-navy/55">{option.description}</span>
                </div>
                {active ? <Check size={17} className="mt-0.5 shrink-0 text-navy" /> : <span className="mt-1 inline-flex shrink-0 text-navy/45" aria-hidden="true">{option.isDark ? <Moon size={14} /> : <Sun size={14} />}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <section aria-label="Aperçu de votre boutique" className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-navy">Aperçu de ma boutique</p>
            <p className="text-xs text-navy/55">Style : {theme.name}</p>
          </div>
          <span className="text-xs text-navy/55">Aperçu indicatif · s&apos;adapte au mobile</span>
        </div>
        <div className="p-3 sm:p-5" style={{ backgroundColor: theme.palette.background }}>
          <div className="mx-auto max-w-3xl overflow-hidden border" style={{ color: theme.palette.primary, backgroundColor: theme.palette.surface, borderColor: `${theme.palette.accent}50` }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: `${theme.palette.accent}35` }}>
              <div>
                <p className="font-serif-display text-sm font-bold tracking-[0.18em]">JAMAAL</p>
                <p className="text-[10px] opacity-60">La boutique de {consultantName || "Votre nom"}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium"><ShoppingBag size={14} /> Panier</span>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[1.1fr_0.9fr] sm:items-center sm:p-6" style={{ background: `linear-gradient(110deg, ${theme.palette.background} 0%, ${theme.palette.surface} 100%)` }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.palette.accent }}>Sélection personnelle</p>
                <h3 className="mt-2 font-serif-display text-xl font-semibold sm:text-2xl">{consultantName || "Votre nom"}</h3>
                <p className="mt-1 text-sm italic" style={{ color: theme.palette.accent }}>{tagline || "Votre phrase d’accroche"}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed opacity-70">{bio || "Présentez votre boutique et accompagnez vos clients dans leur choix."}</p>
                <span className="mt-4 inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: theme.palette.primary }}>Découvrir la boutique</span>
              </div>
              <div className="flex justify-center sm:justify-end">
                <div className="h-28 w-28 overflow-hidden rounded-full border-4 sm:h-36 sm:w-36" style={{ borderColor: theme.palette.accent, backgroundColor: theme.palette.primary }}>
                  {avatarUrl ? <img src={avatarUrl} alt="Photo de la boutique" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-serif-display text-3xl text-white">{initials || "JM"}</span>}
                </div>
              </div>
            </div>
            <div className="border-t px-4 py-4 sm:px-6" style={{ borderColor: `${theme.palette.accent}35` }}>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h4 className="font-serif-display text-base font-semibold">Mes coups de cœur</h4>
                <span className="text-[10px] opacity-60">Sélection du vendeur</span>
              </div>
              {previewProducts.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {previewProducts.map((product) => <article key={product.id} className="min-w-0 border p-2" style={{ borderColor: `${theme.palette.accent}35`, backgroundColor: theme.palette.background }}>
                  <div className="mb-2 flex h-16 items-center justify-center" style={{ background: `linear-gradient(140deg, ${theme.palette.accent}20, ${theme.palette.primary}12)` }}><span className="h-8 w-5 rounded-t-md rounded-b-sm border" style={{ borderColor: `${theme.palette.accent}90`, backgroundColor: `${theme.palette.surface}cc` }} /></div>
                  <p className="truncate text-[11px] font-semibold">{product.name}</p>
                  {product.price != null && <p className="mt-1 text-[10px] font-medium" style={{ color: theme.palette.accent }}>{product.price.toLocaleString("fr-FR")} FCFA</p>}
                </article>)}
              </div> : <p className="text-xs opacity-60">Vos produits disponibles apparaîtront ici.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
