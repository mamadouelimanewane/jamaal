"use client";

import { useState } from "react";
import { Check, Sparkles, Palette, Eye } from "lucide-react";
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
  const initials = consultantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-4">
      {/* Hidden input to pass to the form submit */}
      <input type="hidden" name="theme" value={selectedId} />

      <div className="flex items-center justify-between">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Palette size={16} className="text-rose-dark" />
            Ambiance visuelle & Thème de ma boutique
          </label>
          <p className="text-xs text-navy/60">
            Choisissez l&apos;univers esthétique qui reflète votre image de marque auprès de vos clients.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-navy/80">
          <Sparkles size={12} className="text-amber-500" />
          {SHOP_THEMES.length} thèmes haute couture
        </span>
      </div>

      {/* Grid of themes */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_THEMES.map((theme) => {
          const isSelected = theme.id === selectedId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelectedId(theme.id)}
              className={`group relative flex flex-col items-start rounded-2xl p-4 text-left transition-all ${
                isSelected
                  ? "border-2 border-navy bg-white shadow-md ring-2 ring-navy/10"
                  : "border border-line bg-white/70 hover:border-navy/40 hover:bg-white hover:shadow-sm"
              }`}
            >
              {/* Status badge */}
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: theme.palette.background }}
                    title="Fond"
                  />
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: theme.palette.accent }}
                    title="Accent"
                  />
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: theme.palette.primary }}
                    title="Texte"
                  />
                </div>
                {isSelected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Check size={11} /> Actif
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-navy/40 group-hover:text-navy/70">
                    Sélectionner
                  </span>
                )}
              </div>

              <div className="mt-3">
                <p className="font-serif-display text-sm font-semibold text-navy">{theme.name}</p>
                <p className="text-[11px] font-medium text-rose-dark">{theme.tagline}</p>
                <p className="mt-1 line-clamp-1 text-[11px] text-navy/55">{theme.mood}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Mini Preview */}
      <div className="rounded-2xl border border-line bg-cream/40 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-navy/70">
          <span className="flex items-center gap-1 font-semibold">
            <Eye size={13} className="text-navy" />
            Aperçu instantané : {activeTheme.name}
          </span>
          <span className="italic text-navy/50">{activeTheme.isDark ? "Mode sombre raffiné" : "Mode lumineux poudré"}</span>
        </div>

        {/* Mock phone preview */}
        <div className={`mx-auto max-w-sm rounded-2xl p-4 shadow-sm transition-colors duration-300 ${activeTheme.styles.pageBg}`}>
          <div className="text-center">
            <div className={`mx-auto h-14 w-14 overflow-hidden rounded-full border-2 ${activeTheme.styles.avatarBorder}`}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-serif-display text-lg text-white">
                  {initials || "JM"}
                </span>
              )}
            </div>
            <p className={`mt-2 font-serif-display text-sm font-semibold ${activeTheme.styles.textPrimary}`}>
              {consultantName || "Votre Nom"}
            </p>
            <p className={`text-[11px] ${activeTheme.styles.textSecondary}`}>
              Conseiller·e JAMAAL · Dakar
            </p>
          </div>

          {/* Sample shortcut */}
          <div className={`mt-3 flex items-center justify-between rounded-xl p-2.5 text-xs font-semibold ${activeTheme.styles.cardBg}`}>
            <span className={activeTheme.styles.textPrimary}>Trouver mon parfum en 1 min</span>
            <span className={`text-[11px] ${activeTheme.styles.textMuted}`}>→</span>
          </div>

          {/* Sample product card */}
          <div className={`mt-2 flex items-center gap-2.5 rounded-xl p-2 text-xs ${activeTheme.styles.productCardBg}`}>
            <div className="h-10 w-10 shrink-0 rounded-lg bg-cream/60 flex items-center justify-center">
              <Sparkles size={16} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`line-clamp-1 font-semibold ${activeTheme.styles.textPrimary}`}>Extrait de Parfum N°024</p>
              <p className={`text-[10px] ${activeTheme.styles.textMuted}`}>Inspiré d&apos;une grande maison</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${activeTheme.styles.buttonPrimary}`}>
              Commander
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
