"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Star, Trash2, Wand2 } from "lucide-react";
import { addSkinVisual, generateSkinVisual, moveSkinVisualFirst, removeSkinVisual } from "@/lib/actions/skin-advisor";
import { compressPhoto } from "@/lib/compress-photo";

/** Visuels du Skin Advisor : génération par l'IA (femmes africaines, peaux foncées) ou photo libre de droits. */
export function SkinVisualsManager({ visuals, presets, max, aiReady }: { visuals: string[]; presets: { id: string; label: string }[]; max: number; aiReady: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const full = visuals.length >= max;

  function generate(id: string) {
    setMsg(null);
    setBusy(id);
    start(async () => {
      const r = await generateSkinVisual(id);
      setBusy(null);
      setMsg({ ok: r.ok, text: r.message ?? "" });
    });
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    setMsg(null);
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.set("file", new File([await compressPhoto(f)], "skin-advisor.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/admin/visuel-accueil", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!data.url) throw new Error(data.error ?? "Envoi impossible.");
      const r = await addSkinVisual(data.url);
      setMsg({ ok: r.ok, text: r.message ?? "" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Envoi impossible." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Visuels affichés ({visuals.length} / {max})</h2>
        {visuals.length === 0 ? (
          <p className="mt-2 text-sm text-navy/70">Aucun visuel : la page affiche une illustration de femmes africaines. Générez ou ajoutez des photos ci-dessous.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {visuals.map((src, i) => (
              <li key={src} className="overflow-hidden rounded-xl border border-line bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element -- visuel du stockage */}
                <img src={src} alt={`Visuel ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                <div className="flex items-center justify-between gap-1 p-1.5">
                  {i === 0 ? <span className="px-1 text-[11px] font-semibold text-emerald-700">Principal</span> : (
                    <button type="button" disabled={pending} onClick={() => start(() => moveSkinVisualFirst(src))} title="Mettre en premier" className="rounded p-1 text-navy/70 hover:bg-white"><Star size={14} /></button>
                  )}
                  <button type="button" disabled={pending} onClick={() => start(() => removeSkinVisual(src))} aria-label="Supprimer ce visuel" className="rounded p-1 text-rose-dark hover:bg-white"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ia/30 bg-white p-5">
        <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Wand2 size={18} /> Générer une photo avec l&apos;IA</h2>
        <p className="mt-1 text-sm text-navy/75">Photos réalistes de femmes africaines aux peaux foncées, sans logo ni marque (Google Gemini). Environ 20 à 40 secondes par photo.</p>
        {!aiReady && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Ajoutez GOOGLE_AI_API_KEY dans Vercel pour générer des photos.</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((p) => (
            <button key={p.id} type="button" disabled={!!busy || full || !aiReady} onClick={() => generate(p.id)} className="inline-flex items-center justify-center gap-2 rounded-full border border-ia px-4 py-2.5 text-sm font-semibold text-ia-dark hover:bg-ia-light/40 disabled:opacity-50">
              {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><ImagePlus size={18} /> Ajouter une photo libre de droits</h2>
        <p className="mt-1 text-sm text-navy/75">Par exemple depuis Unsplash ou Pexels (recherchez « african woman skincare ») : téléchargez la photo, puis envoyez-la ici. Format portrait conseillé.</p>
        <button type="button" disabled={!!busy || full} onClick={() => file.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
          {busy === "upload" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Choisir une photo
        </button>
        <input ref={file} type="file" accept="image/*" onChange={upload} className="sr-only" tabIndex={-1} aria-hidden="true" />
      </section>

      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose/10 text-rose-dark"}`}>{msg.text}</p>}
    </div>
  );
}
