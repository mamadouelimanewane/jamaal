"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";

/**
 * Photo d'une pièce d'identité : prise avec l'appareil photo OU choisie dans la galerie / les fichiers.
 * (L'ancien champ imposait l'appareil photo sur téléphone : impossible d'envoyer une photo déjà prise.)
 */
export function IdPhotoPicker({ id, label, file, onChange, invalid }: { id: string; label: string; file: File | null; onChange: (f: File | null) => void; invalid?: boolean }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0] ?? null;
    if (f) onChange(f);
    e.currentTarget.value = "";
  };
  const btn = "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition";

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-xs font-semibold uppercase tracking-wide text-navy/60">{label}</p>
      <div className={`mt-1.5 rounded-xl border bg-white p-3 ${invalid && !file ? "border-rose-dark ring-4 ring-rose/10" : "border-line"}`}>
        {file && preview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
            <img src={preview} alt={`Aperçu : ${label}`} className="h-16 w-24 shrink-0 rounded-lg border border-line object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy">{file.name || "Photo"}</p>
              <button type="button" onClick={() => onChange(null)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-dark hover:underline">
                <RefreshCw size={12} /> Changer de photo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => camera.current?.click()} className={`${btn} border-navy bg-navy text-white hover:bg-navy-light`}>
              <Camera size={16} /> Prendre une photo
            </button>
            <button type="button" onClick={() => gallery.current?.click()} className={`${btn} border-line text-navy hover:bg-cream`}>
              <ImagePlus size={16} /> Galerie ou fichiers
            </button>
          </div>
        )}
        <input ref={camera} id={`${id}-camera`} type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <input ref={gallery} id={id} type="file" accept="image/*" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
      </div>
    </div>
  );
}
