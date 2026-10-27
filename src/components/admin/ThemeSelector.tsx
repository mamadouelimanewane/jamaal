"use client";

import { useState } from "react";
import { Check, Sparkles, Palette, Eye, Moon, Sun, ShoppingBag, Phone, Star, ShieldCheck, Truck } from "lucide-react";
import { SHOP_THEMES, DEFAULT_THEME_ID, type ShopThemeId, getShopTheme } from "@/lib/shop/themes";

interface ThemeSelectorProps {
  initialTheme: string | null | undefined;
  consultantName: string;
  avatarUrl: string | null;
}

export function ThemeSelector({ initialTheme, consultantName, avatarUrl }: ThemeSelectorProps) {
  const [selectedId, setSelectedId] = useState<ShopThemeId>(
    (initialTheme && SHOP_THEMES.some((t) => t.id === initialTheme)
      ? (initialTheme as ShopThemeId)
      : DEFAULT_THEME_ID)
  );

  const activeTheme = getShopTheme(selectedId);
  const st = activeTheme.styles;

  const initials = consultantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      {/* Champ caché pour la soumission du formulaire */}
      <input type="hidden" name="theme" value={selectedId} />

      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Palette size={16} className="text-rose-dark" />
            Design E-commerce · Thème de ma boutique en ligne
          </label>
          <p className="mt-0.5 text-xs text-navy/60">
            Choisissez l&apos;univers esthétique qui habillera votre site web personnel auprès de vos clients.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 shadow-xs">
          <Sparkles size={12} />
          {SHOP_THEMES.length} Thèmes Haute Parfumerie
        </span>
      </div>

      {/* Grille des thèmes disponibles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_THEMES.map((theme) => {
          const isSelected = theme.id === selectedId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelectedId(theme.id)}
              className={[
                "group relative flex flex-col rounded-2xl text-left transition-all duration-300 overflow-hidden cursor-pointer",
                isSelected
                  ? "border-2 border-navy shadow-xl ring-2 ring-navy/15 scale-[1.02]"
                  : "border border-line bg-white/90 hover:border-navy/40 hover:shadow-md hover:scale-[1.01]",
              ].join(" ")}
            >
              {/* Bandeau d'ambiance avec swatches */}
              <div
                className="h-16 w-full relative overflow-hidden"
                style={{
                  background: `radial-gradient(ellipse at 30% 50%, ${theme.palette.glow}66 0%, ${theme.palette.background} 65%, ${theme.palette.surface} 100%)`,
                }}
              >
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                  <span
                    className="h-5 w-5 rounded-full border-2 border-white/70 shadow-sm"
                    style={{ background: theme.palette.background }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border-2 border-white/70 shadow-sm"
                    style={{ background: theme.palette.accent }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white/70 shadow-sm"
                    style={{ background: theme.palette.primary }}
                  />
                </div>
                <div className="absolute top-2 right-2.5 flex items-center gap-1.5 bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded-full">
                  <span className="text-sm">{theme.emoji}</span>
                  {theme.isDark ? (
                    <Moon size={11} className="text-amber-300" />
                  ) : (
                    <Sun size={11} className="text-amber-400" />
                  )}
                </div>
                {isSelected && (
                  <span className="absolute top-2 left-2.5 inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <Check size={10} /> Actif
                  </span>
                )}
              </div>

              {/* Description */}
              <div className={`p-3.5 ${isSelected ? "bg-navy/4" : "bg-white"} flex-1 flex flex-col justify-between`}>
                <div>
                  <p className="font-serif-display text-sm font-bold text-navy leading-tight">
                    {theme.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-rose-dark line-clamp-1">
                    {theme.tagline}
                  </p>
                  <p className="mt-1 text-[11px] text-navy/55 line-clamp-2 leading-relaxed">
                    {theme.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── APERÇU GRAND FORMAT DU SITE WEB REVENDEUR ─────────────────────────── */}
      <div className="rounded-3xl border border-line bg-white overflow-hidden shadow-xl">
        {/* Barre supérieure du preview */}
        <div className="flex items-center justify-between border-b border-line bg-slate-50/90 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500" />
            <span className="font-serif-display text-xs font-bold text-navy">
              Aperçu en direct du Site Web · Thème : {activeTheme.name}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-navy/60">
            {activeTheme.isDark ? "🌙 Mode Nuit Prestigieux" : "☀️ Mode Lumineux Épuré"}
          </span>
        </div>

        {/* Simulation complète du site e-commerce */}
        <div
          className="p-4 sm:p-6 transition-all duration-300 text-left"
          style={{
            background: activeTheme.isDark
              ? `radial-gradient(ellipse at top, ${activeTheme.palette.glow}25 0%, ${activeTheme.palette.background} 50%)`
              : `radial-gradient(ellipse at top, ${activeTheme.palette.glow}35 0%, ${activeTheme.palette.background} 45%, #ffffff 90%)`,
          }}
        >
          <div className="mx-auto max-w-xl space-y-4">

            {/* 1. Simulation Top Bar */}
            <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-xs py-1.5 px-3 text-center text-[10px] uppercase tracking-wider font-bold" style={{ color: activeTheme.palette.primary }}>
              ✦ Haute Parfumerie Chogan Italie · 30% d&apos;Essence Pure · Livraison Express Dakar
            </div>

            {/* 2. Simulation Header Web */}
            <div
              className="flex items-center justify-between p-3 rounded-2xl border shadow-sm backdrop-blur-md"
              style={{
                backgroundColor: activeTheme.isDark ? `${activeTheme.palette.surface}f0` : "rgba(255,255,255,0.92)",
                borderColor: `${activeTheme.palette.accent}33`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-serif-display font-bold text-sm tracking-widest" style={{ color: activeTheme.palette.primary }}>
                  JAMAAL
                </span>
                <span className="text-[10px] opacity-60" style={{ color: activeTheme.palette.primary }}>
                  · Boutique de {consultantName || "Votre Nom"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                  En Ligne
                </span>
                <span className="rounded-full p-1.5 text-xs text-white shadow-xs" style={{ background: "#25D366" }}>
                  <Phone size={11} />
                </span>
              </div>
            </div>

            {/* 3. Simulation Hero Banner de Site Web */}
            <div
              className="p-5 rounded-3xl border shadow-md flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
              style={{
                backgroundColor: activeTheme.isDark ? `${activeTheme.palette.surface}d0` : "rgba(255,255,255,0.85)",
                borderColor: `${activeTheme.palette.accent}40`,
              }}
            >
              <div
                className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-xl relative"
                style={{
                  border: `3px solid ${activeTheme.palette.accent}`,
                  boxShadow: `0 0 0 4px ${activeTheme.palette.glow}30`,
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center font-serif-display text-2xl font-bold text-white"
                    style={{ backgroundColor: activeTheme.palette.primary }}
                  >
                    {initials || "JM"}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs mb-1" style={{ backgroundColor: `${activeTheme.palette.accent}20`, color: activeTheme.palette.accent }}>
                  Conseiller·e Agréé·e · Dakar
                </span>
                <h4 className="font-serif-display text-lg font-bold" style={{ color: activeTheme.palette.primary }}>
                  {consultantName || "Votre Nom"}
                </h4>
                <p className="font-serif-display text-xs italic mt-0.5" style={{ color: activeTheme.palette.accent }}>
                  « {activeTheme.tagline} »
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="rounded-xl px-2.5 py-1 text-[10px] font-bold text-white shadow-sm flex items-center gap-1" style={{ background: "#25D366" }}>
                    <span>💬</span> WhatsApp Direct
                  </span>
                  <span className="rounded-xl px-2.5 py-1 text-[10px] font-semibold border shadow-xs" style={{ borderColor: `${activeTheme.palette.accent}55`, color: activeTheme.palette.primary }}>
                    🔍 Explorer les parfums
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Simulation Grille E-commerce 2 Cartes Produits */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Baccarat Rouge 540", brand: "Extrait Privé N°118", price: "42 600 FCFA" },
                { name: "Black Opium", brand: "Extrait Femme N°055", price: "14 800 FCFA" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-3 border shadow-sm flex flex-col justify-between"
                  style={{
                    backgroundColor: activeTheme.isDark ? `${activeTheme.palette.surface}f0` : "rgba(255,255,255,0.95)",
                    borderColor: `${activeTheme.palette.accent}25`,
                  }}
                >
                  <div className="h-20 rounded-xl bg-neutral-200/30 flex items-center justify-center text-2xl mb-2 relative overflow-hidden">
                    <span className="text-2xl">✨</span>
                    <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                      30% Pur
                    </span>
                  </div>
                  <div>
                    <p className="font-serif-display text-xs font-bold line-clamp-1" style={{ color: activeTheme.palette.primary }}>
                      {item.name}
                    </p>
                    <p className="text-[10px] italic line-clamp-1" style={{ color: activeTheme.palette.accent }}>
                      {item.brand}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold" style={{ color: activeTheme.palette.accent }}>
                        {item.price}
                      </span>
                      <span className="rounded-lg px-2 py-0.5 text-[9px] font-bold text-white shadow-xs" style={{ backgroundColor: activeTheme.palette.primary }}>
                        Commander
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 5. Simulation Réassurance */}
            <div
              className="p-3 rounded-2xl border text-center flex items-center justify-around text-[10px] font-medium"
              style={{
                backgroundColor: activeTheme.isDark ? `${activeTheme.palette.surface}a0` : "rgba(255,255,255,0.8)",
                borderColor: `${activeTheme.palette.accent}20`,
                color: activeTheme.palette.primary,
              }}
            >
              <span className="flex items-center gap-1">🛡️ Produits Certifiés</span>
              <span className="flex items-center gap-1">🚚 Livraison Dakar 24h</span>
              <span className="flex items-center gap-1">💳 Wave &amp; OM</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}