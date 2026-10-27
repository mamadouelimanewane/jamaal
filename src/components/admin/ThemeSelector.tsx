"use client";

import { useState } from "react";
import { Check, Sparkles, Palette, Eye, Moon, Sun } from "lucide-react";
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
    <div className="space-y-5">
      {/* Hidden input pour le form */}
      <input type="hidden" name="theme" value={selectedId} />

      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Palette size={15} className="text-rose-dark" />
            Ambiance visuelle · Thème de ma boutique
          </label>
          <p className="mt-0.5 text-xs text-navy/55">
            Choisissez l&apos;identité esthétique qui reflète votre style et séduira vos clients.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          <Sparkles size={11} />
          {SHOP_THEMES.length} thèmes luxe
        </span>
      </div>

      {/* Grille des thèmes */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_THEMES.map((theme) => {
          const isSelected = theme.id === selectedId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelectedId(theme.id)}
              className={[
                "group relative flex flex-col rounded-2xl text-left transition-all duration-200 overflow-hidden",
                isSelected
                  ? "border-2 border-navy shadow-lg ring-2 ring-navy/10 scale-[1.02]"
                  : "border border-line bg-white/80 hover:border-navy/40 hover:shadow-md hover:scale-[1.01]",
              ].join(" ")}
            >
              {/* Bandeau de couleur (preview visuel) */}
              <div
                className="h-14 w-full relative overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 30% 50%, ${theme.palette.glow}55 0%, ${theme.palette.background} 60%, ${theme.palette.surface} 100%)` }}
              >
                {/* Swatches inline */}
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                  <span
                    className="h-5 w-5 rounded-full border-2 border-white/60 shadow-md"
                    style={{ background: theme.palette.background }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border-2 border-white/60 shadow-md"
                    style={{ background: theme.palette.accent }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white/60 shadow-md"
                    style={{ background: theme.palette.primary }}
                  />
                </div>
                {/* Emoji + mode */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="text-base leading-none">{theme.emoji}</span>
                  {theme.isDark ? (
                    <Moon size={11} className="text-white/70" />
                  ) : (
                    <Sun size={11} className="text-amber-600/70" />
                  )}
                </div>
                {/* Badge sélectionné */}
                {isSelected && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    <Check size={9} /> Actif
                  </span>
                )}
              </div>

              {/* Infos textuelles */}
              <div className={`p-3 ${isSelected ? "bg-navy/3" : "bg-white"} flex-1`}>
                <p className="font-serif-display text-[13px] font-semibold text-navy leading-tight">
                  {theme.name}
                </p>
                <p className="mt-0.5 text-[10px] text-rose-dark font-medium line-clamp-1">
                  {theme.tagline}
                </p>
                <p className="mt-1 text-[10px] text-navy/45 line-clamp-2 leading-snug">
                  {theme.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Preview live enrichi */}
      <div className="rounded-2xl border border-line bg-cream/30 overflow-hidden shadow-sm">
        {/* Header preview */}
        <div className="flex items-center justify-between border-b border-line bg-white/60 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-navy">
            <Eye size={13} className="text-rose-dark" />
            Aperçu · {activeTheme.name}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-navy/50">
            {activeTheme.isDark ? (
              <><Moon size={11} className="text-navy/40" /> Sombre raffiné</>
            ) : (
              <><Sun size={11} className="text-amber-500" /> Lumineux luxe</>
            )}
          </div>
        </div>

        {/* Simulation de la page boutique */}
        <div
          className="p-4 transition-all duration-300"
          style={{
            background: activeTheme.isDark
              ? `radial-gradient(ellipse at top, ${activeTheme.palette.glow}18 0%, ${activeTheme.palette.background} 60%)`
              : `radial-gradient(ellipse at top, ${activeTheme.palette.glow}30 0%, ${activeTheme.palette.background} 50%, #ffffff 100%)`,
          }}
        >
          <div className="mx-auto max-w-xs space-y-3">
            {/* Avatar + nom */}
            <div className="text-center">
              <div
                className="mx-auto h-14 w-14 overflow-hidden rounded-full shadow-xl"
                style={{
                  border: `3px solid ${activeTheme.palette.accent}`,
                  boxShadow: `0 0 0 4px ${activeTheme.palette.glow}22, 0 8px 24px rgba(0,0,0,0.25)`,
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center font-serif-display text-xl font-bold text-white"
                    style={{ backgroundColor: activeTheme.palette.primary }}
                  >
                    {initials || "JM"}
                  </span>
                )}
              </div>
              <p
                className="mt-2 font-serif-display text-[13px] font-semibold tracking-wide"
                style={{ color: activeTheme.palette.primary }}
              >
                {consultantName || "Votre Nom"}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: `${activeTheme.palette.primary}80` }}>
                Conseiller·e JAMAAL · Dakar
              </p>
              {/* Tagline simulé */}
              <p
                className="mt-1 font-serif-display text-[10px] italic"
                style={{ color: `${activeTheme.palette.accent}` }}
              >
                « {activeTheme.tagline} »
              </p>
            </div>

            {/* Bouton WhatsApp simulé */}
            <div
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #25D366, #1aad54)" }}
            >
              <span>💬</span> Me contacter sur WhatsApp
            </div>

            {/* Raccourci simulé */}
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition"
              style={{
                backgroundColor: activeTheme.isDark
                  ? `${activeTheme.palette.surface}ee`
                  : "rgba(255,255,255,0.85)",
                border: `1px solid ${activeTheme.palette.accent}28`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              }}
            >
              <span style={{ color: activeTheme.palette.primary }}>✨ Trouver mon parfum en 1 min</span>
              <span style={{ color: `${activeTheme.palette.accent}99` }}>→</span>
            </div>

            {/* Carte produit simulée */}
            <div
              className="flex items-center gap-2.5 rounded-xl overflow-hidden"
              style={{
                backgroundColor: activeTheme.isDark
                  ? `${activeTheme.palette.surface}ee`
                  : "rgba(255,255,255,0.88)",
                border: `1px solid ${activeTheme.palette.accent}22`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              }}
            >
              <div
                className="h-14 w-14 shrink-0 flex items-center justify-center text-xl"
                style={{ backgroundColor: `${activeTheme.palette.accent}15` }}
              >
                🌹
              </div>
              <div className="flex-1 min-w-0 py-2 pr-2">
                <p
                  className="text-[11px] font-semibold line-clamp-1"
                  style={{ color: activeTheme.palette.primary }}
                >
                  Extrait de Parfum N°024
                </p>
                <p
                  className="text-[10px] italic line-clamp-1"
                  style={{ color: `${activeTheme.palette.accent}` }}
                >
                  Inspiré de Black Opium · YSL
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: activeTheme.palette.accent }}
                  >
                    14 800 FCFA
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow"
                    style={{ background: `linear-gradient(135deg, ${activeTheme.palette.accent}, ${activeTheme.palette.glow})` }}
                  >
                    Commander
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer du preview */}
        <div className="border-t border-line bg-white/50 px-4 py-2 text-center">
          <p className="text-[10px] text-navy/40 italic">
            {activeTheme.mood}
          </p>
        </div>
      </div>
    </div>
  );
}
