"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageUp, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { HomeCarousel } from "@/components/HomeCarousel";
import { saveHomeCarouselAction, resetHomeCarouselAction } from "@/lib/actions/home-carousel";
import { categoryFromHref, MAX_SLIDES, SLIDE_THEMES, type HeroSlide, type SlideTheme } from "@/lib/home-slides";

const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

/** Éditeur du carrousel d'accueil : textes, lien, visuel, couleur, ordre, aperçu en direct. */
export function HomeCarouselEditor({
  initial,
  ranges,
  photos,
}: {
  initial: HeroSlide[];
  ranges: { slug: string; label: string }[];
  /** Photo par défaut de chaque gamme (quand aucun visuel n'est envoyé). */
  photos: Record<string, string>;
}) {
  const [slides, setSlides] = useState<HeroSlide[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function update(id: string, patch: Partial<HeroSlide>) {
    setSlides((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
    setMsg(null);
  }
  function move(i: number, d: -1 | 1) {
    setSlides((all) => {
      const next = [...all];
      const j = i + d;
      if (j < 0 || j >= next.length) return all;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }
  function remove(id: string) {
    setSlides((all) => all.filter((s) => s.id !== id));
    setDirty(true);
  }
  function add() {
    const id = `diapo-${Date.now().toString(36)}`;
    setSlides((all) => [...all, { id, eyebrow: "Nouveauté", title: "Votre slogan *ici.*", subtitle: "", ctaLabel: "Découvrir", href: "/collections/parfum-femme", image: "", theme: "nuit", active: true }]);
    setDirty(true);
  }

  async function upload(file: File) {
    const id = fileFor.current;
    if (!id) return;
    setUploading(id);
    setMsg(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const r = await fetch("/api/admin/visuel-accueil", { method: "POST", body });
      const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !data.url) setMsg({ ok: false, text: data.error ?? "Envoi impossible." });
      else update(id, { image: data.url });
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function save() {
    start(async () => {
      const r = await saveHomeCarouselAction(slides);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setSlides(r.slides);
        setDirty(false);
        setMsg({ ok: true, text: "Carrousel enregistré : il est en ligne sur la page d'accueil." });
      }
    });
  }
  function reset() {
    if (!window.confirm("Remettre le carrousel par défaut ? Vos diapositives seront remplacées.")) return;
    start(async () => {
      const r = await resetHomeCarouselAction();
      if (r.ok) {
        setSlides(r.slides);
        setDirty(false);
        setMsg({ ok: true, text: "Carrousel par défaut rétabli." });
      }
    });
  }

  const preview = slides.filter((s) => s.active && s.title.trim()).map((s) => ({ ...s, resolvedImage: s.image || photos[categoryFromHref(s.href) ?? ""] || null }));

  return (
    <div className="space-y-6">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

      <section className="overflow-hidden rounded-2xl border border-line">
        <p className="flex items-center gap-2 bg-cream px-4 py-2 text-sm font-semibold text-navy"><Eye size={15} /> Aperçu</p>
        <div className="pointer-events-auto origin-top-left">
          {preview.length ? <HomeCarousel key={preview.map((s) => s.id).join()} slides={preview} /> : <p className="p-6 text-sm text-navy/70">Aucune diapositive affichée.</p>}
        </div>
      </section>

      <ol className="space-y-4">
        {slides.map((s, i) => {
          const img = s.image || photos[categoryFromHref(s.href) ?? ""];
          const known = ranges.some((r) => `/collections/${r.slug}` === s.href);
          return (
            <li key={s.id} className={`rounded-2xl border bg-white p-4 sm:p-5 ${s.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">Diapositive {i + 1}{!s.active && " · masquée"}</p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter" className="rounded-lg p-2 text-navy hover:bg-cream disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === slides.length - 1} aria-label="Descendre" className="rounded-lg p-2 text-navy hover:bg-cream disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => update(s.id, { active: !s.active })} aria-label={s.active ? "Masquer" : "Afficher"} className="rounded-lg p-2 text-navy hover:bg-cream">{s.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button type="button" onClick={() => remove(s.id)} aria-label="Supprimer" className="rounded-lg p-2 text-rose-dark hover:bg-rose-50"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="mt-3 grid gap-4 md:grid-cols-[180px_1fr]">
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl" style={{ background: `linear-gradient(120deg, ${SLIDE_THEMES[s.theme].from}, ${SLIDE_THEMES[s.theme].to})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                    {uploading === s.id && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Loader2 className="animate-spin" /></span>}
                  </div>
                  <button type="button" onClick={() => { fileFor.current = s.id; fileInput.current?.click(); }} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white">
                    <ImageUp size={14} /> Envoyer un visuel
                  </button>
                  {s.image ? (
                    <button type="button" onClick={() => update(s.id, { image: "" })} className="mt-1 w-full text-xs text-navy/70 hover:underline">Utiliser la photo de la gamme</button>
                  ) : (
                    <p className="mt-1 text-center text-[11px] text-navy/60">Photo d&apos;un produit de la gamme</p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-navy/85">Petit titre<input value={s.eyebrow} maxLength={40} onChange={(e) => update(s.id, { eyebrow: e.target.value })} className={field} /></label>
                  <label className="text-xs font-medium text-navy/85">Couleur de fond
                    <select value={s.theme} onChange={(e) => update(s.id, { theme: e.target.value as SlideTheme })} className={field}>
                      {Object.entries(SLIDE_THEMES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-navy/85 sm:col-span-2">Slogan <span className="font-normal text-navy/60">(mettez un mot entre *astérisques* pour le colorer)</span>
                    <input value={s.title} maxLength={90} required onChange={(e) => update(s.id, { title: e.target.value })} className={field} />
                  </label>
                  <label className="text-xs font-medium text-navy/85 sm:col-span-2">Phrase d&apos;accroche<textarea value={s.subtitle} maxLength={220} rows={2} onChange={(e) => update(s.id, { subtitle: e.target.value })} className={field} /></label>
                  <label className="text-xs font-medium text-navy/85">Texte du bouton<input value={s.ctaLabel} maxLength={40} onChange={(e) => update(s.id, { ctaLabel: e.target.value })} className={field} /></label>
                  <label className="text-xs font-medium text-navy/85">Lien du bouton
                    <select value={known ? s.href : "autre"} onChange={(e) => e.target.value !== "autre" && update(s.id, { href: e.target.value })} className={field}>
                      {ranges.map((r) => <option key={r.slug} value={`/collections/${r.slug}`}>{r.label}</option>)}
                      <option value="autre">Autre lien…</option>
                    </select>
                  </label>
                  {!known && (
                    <label className="text-xs font-medium text-navy/85 sm:col-span-2">Adresse du lien <span className="font-normal text-navy/60">(/produits/…, /coffrets-decouverte, ou https://…)</span>
                      <input value={s.href} onChange={(e) => update(s.id, { href: e.target.value })} className={field} />
                    </label>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
          {pending && <Loader2 size={15} className="animate-spin" />} Enregistrer et publier
        </button>
        <button type="button" onClick={add} disabled={slides.length >= MAX_SLIDES} className="inline-flex items-center gap-1.5 rounded-full border border-navy px-4 py-2.5 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-40"><Plus size={15} /> Ajouter une diapositive</button>
        <button type="button" onClick={reset} disabled={pending} className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm text-navy/75 hover:underline"><RotateCcw size={14} /> Par défaut</button>
        {dirty && !msg && <span className="text-sm text-amber-800">Modifications non enregistrées</span>}
        {msg && <span role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-800" : "text-rose-dark"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
