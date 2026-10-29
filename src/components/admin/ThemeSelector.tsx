"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import {
  SHOP_THEMES,
  SHOP_HEROES,
  SHOP_TYPOS,
  SHOP_SECTIONS,
  getShopTheme,
  normalizeAccent,
  normalizeHero,
  normalizeHidden,
  normalizeThemeId,
  normalizeTypo,
  type ShopHero,
  type ShopSection,
  type ShopThemeId,
  type ShopTypo,
} from "@/lib/shop/themes";

export interface ThemeSelectorProps {
  initialTheme: string | null | undefined;
  initialAccent?: number | null;
  initialHero?: string | null;
  initialTypo?: string | null;
  initialHidden?: string[] | null;
  consultantName: string;
  avatarUrl: string | null;
  logoUrl?: string | null;
}

const pill = (on: boolean) =>
  `min-h-10 rounded-full border px-3.5 py-2 text-sm font-medium transition ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:bg-cream"}`;

/**
 * Apparence de la boutique (/c/<slug>) : thème, accent, mise en avant, typographie et sections.
 * Les choix partent avec le formulaire de Ma boutique (champs cachés) ; l'aperçu se met à jour en direct.
 */
export function ThemeSelector({ initialTheme, initialAccent, initialHero, initialTypo, initialHidden, consultantName, avatarUrl, logoUrl = null }: ThemeSelectorProps) {
  const [themeId, setThemeId] = useState<ShopThemeId>(normalizeThemeId(initialTheme));
  const [accent, setAccent] = useState<0 | 1 | 2>(normalizeAccent(initialAccent));
  const [hero, setHero] = useState<ShopHero>(normalizeHero(initialHero));
  const [typo, setTypo] = useState<ShopTypo>(normalizeTypo(initialTypo));
  const [hidden, setHidden] = useState<ShopSection[]>(normalizeHidden(initialHidden));

  const t = getShopTheme(themeId);
  const acc = t.accents[accent];
  const display = typo === "classique" ? "'Playfair Display', Georgia, serif" : `'${t.displayName}', Georgia, serif`;
  const body = typo === "classique" ? "'Poppins', system-ui, sans-serif" : `'${t.bodyName}', system-ui, sans-serif`;
  const first = consultantName.split(/\s+/)[0] || "Moi";
  const initials = consultantName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  // Comme sur la boutique : le logo en haut, sinon la photo, sinon les initiales.
  const previewMark = (small = false) =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={`mx-auto block w-auto object-contain ${small ? "max-h-10 max-w-[140px]" : "max-h-14 max-w-[160px]"}`} />
    ) : avatarUrl ? (
      <div className="mx-auto h-[72px] w-[58px] overflow-hidden" style={{ borderRadius: t.portrait, border: `1px solid ${t.line}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </div>
    ) : (
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: t.soft, border: `1px solid ${acc}`, color: t.ink }}>
        <span style={{ fontFamily: display, fontSize: 20 }}>{initials}</span>
      </div>
    );
  const toggle = (s: ShopSection) => setHidden((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]));
  const show = (s: ShopSection) => !hidden.includes(s);

  return (
    <div className="space-y-6">
      <input type="hidden" name="theme" value={themeId} />
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="hero" value={hero} />
      <input type="hidden" name="typo" value={typo} />
      {hidden.map((h) => <input key={h} type="hidden" name="hidden" value={h} />)}

      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Palette size={16} className="text-rose-dark" aria-hidden="true" /> Apparence de ma boutique
        </p>
        <p className="mt-1 text-xs text-navy/70">Choisissez un thème, puis ajustez l&apos;accent et la mise en avant. Enregistrez en bas de page pour publier.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-navy/60">1 · Thème</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SHOP_THEMES.map((x) => {
                const on = x.id === themeId;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setThemeId(x.id); setAccent(0); }}
                    className={`relative min-h-[76px] rounded-xl bg-white p-3 text-left transition ${on ? "border-2 border-navy" : "border border-line hover:border-navy/40"}`}
                  >
                    <span className="flex gap-1" aria-hidden="true">
                      {[x.bg, x.ink, x.accents[0]].map((c) => <span key={c} className="h-5 w-5 rounded-md border border-black/10" style={{ background: c }} />)}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-navy">{x.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-navy/65">{x.mood}</span>
                    {on && <Check size={16} className="absolute right-2 top-2 text-navy" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-navy/60">2 · Accent</legend>
            <div className="mt-2 flex gap-3">
              {t.accents.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Accent ${i + 1}`}
                  aria-pressed={accent === i}
                  onClick={() => setAccent(i as 0 | 1 | 2)}
                  className="h-11 w-11 rounded-full transition"
                  style={{ background: c, border: accent === i ? "3px solid #fff" : "1px solid #D9D3CC", boxShadow: accent === i ? "0 0 0 2px #1D2F4F" : undefined }}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-navy/60">3 · Haut de page</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHOP_HEROES.map((h) => (
                <button key={h.id} type="button" aria-pressed={hero === h.id} onClick={() => setHero(h.id)} className={pill(hero === h.id)}>{h.label}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-navy/60">« Un produit vedette » met en avant votre premier coup de cœur.</p>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-navy/60">4 · Typographie</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHOP_TYPOS.map((h) => (
                <button key={h.id} type="button" aria-pressed={typo === h.id} onClick={() => setTypo(h.id)} className={pill(typo === h.id)}>{h.label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-navy/60">5 · Sections affichées</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SHOP_SECTIONS.map((s) => (
                <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3 text-sm text-navy">
                  <input type="checkbox" checked={show(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 shrink-0 accent-navy" />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Aperçu (couleurs et mise en page ; les polices du thème s'affichent sur la boutique). */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy/60">Aperçu</p>
          <div className="mx-auto w-[280px] overflow-hidden rounded-[30px] border-[8px] border-[#1B1B1D] text-left" style={{ background: t.bg, color: t.ink, fontFamily: body }} aria-hidden="true">
            <div className="px-2 py-1.5 text-center text-[8px] uppercase tracking-[0.14em]" style={{ background: t.ink, color: t.bg }}>Conseil et commande sur WhatsApp</div>
            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: `1px solid ${t.line}` }}>
              <span style={{ fontFamily: display, letterSpacing: "0.3em", fontSize: 15 }}>JAMAAL</span>
              <span className="rounded-full px-2 py-1 text-[9px] font-semibold text-white" style={{ background: "#128C4B" }}>WhatsApp</span>
            </div>
            {t.decor && <div style={{ height: 4, background: t.decor }} />}
            <div className="max-h-[430px] overflow-hidden">
              {hero === "banner" ? (
                <div className="m-3 rounded-2xl px-3 py-5 text-center text-white" style={{ background: acc }}>
                  <div className={logoUrl ? "mx-auto inline-block rounded-lg bg-white px-2 py-1.5" : ""}>{previewMark(true)}</div>
                  <div className="mt-2 text-[8px] uppercase tracking-[0.2em]">Votre conseiller</div>
                  <div className="mt-1" style={{ fontFamily: display, fontSize: 22, lineHeight: 1.05 }}>{consultantName}</div>
                </div>
              ) : (
                <div className="px-3 pb-3 pt-4 text-center">
                  {previewMark()}
                  <div className="mt-3 text-[8px] uppercase tracking-[0.2em]" style={{ color: acc }}>La boutique de votre conseiller</div>
                  <div className="mt-1" style={{ fontFamily: display, fontSize: 22, lineHeight: 1.05 }}>{consultantName}</div>
                  {hero === "showcase" && (
                    <div className="mt-2.5 flex items-center gap-2.5 rounded-xl p-2 text-left" style={{ background: t.surface, border: `1px solid ${t.line}` }}>
                      <div className="h-12 w-10 rounded-lg" style={{ background: t.tints[0], border: `1px solid ${t.line}` }} />
                      <div>
                        <div className="text-[8px] uppercase tracking-[0.18em]" style={{ color: acc }}>Le conseil de {first}</div>
                        <div style={{ fontFamily: display, fontSize: 13 }}>Mon coup de cœur</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="px-3"><div className="rounded-full py-2 text-center text-[10px] font-semibold text-white" style={{ background: "#128C4B" }}>Échanger avec {first}</div></div>
              {show("services") && (
                <div className="mt-3 grid grid-cols-2 gap-1.5 px-3 py-2.5" style={{ background: t.soft }}>
                  {["Parfum ADN", "Catalogue"].map((s) => (
                    <div key={s} className="rounded-lg px-2 py-2 text-[10px]" style={{ background: t.surface, border: `1px solid ${t.line}` }}>{s}</div>
                  ))}
                </div>
              )}
              {show("products") && (
                <div className="px-3 pt-3">
                  <div className="text-center" style={{ fontFamily: display, fontSize: 14 }}>Les coups de cœur de {first}</div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {[0, 1].map((i) => (
                      <div key={i} className="overflow-hidden rounded-lg" style={{ background: t.surface, border: `1px solid ${t.line}` }}>
                        <div className="h-14" style={{ background: t.tints[i % t.tints.length] }} />
                        <div className="p-1.5"><div className="rounded-full py-1 text-center text-[8px] font-semibold text-white" style={{ background: acc }}>Commander</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {show("steps") && (
                <div className="mt-3 px-3 py-3 text-center text-[11px]" style={{ background: t.dark, color: t.darkInk, fontFamily: display }}>Commander, simplement</div>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-navy/60">Thème {t.name}</p>
        </div>
      </div>
    </div>
  );
}
