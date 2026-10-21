"use client";

import { useState } from "react";
import { compressPhoto } from "@/lib/compress-photo";

/** Champ photo de pièce d'identité : la photo est réduite dans le navigateur avant l'envoi (limite de 4 Mo du formulaire). */
export function IdPhotoInput({ name, label, previewSrc }: { name: string; label: string; previewSrc?: string }) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="text-xs font-medium text-navy/85">
      {label}
      {previewSrc && !picked && (
        <a href={previewSrc} target="_blank" rel="noopener noreferrer" className="mt-1 block w-fit" title="Ouvrir en grand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt={label} className="h-20 w-32 rounded-md border border-line object-cover" />
        </a>
      )}
      <input
        name={name}
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file) return setPicked(null);
          setBusy(true);
          try {
            const blob = await compressPhoto(file);
            if (blob !== file) {
              const dt = new DataTransfer();
              dt.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
              input.files = dt.files;
            }
            setPicked(file.name);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-1 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
      />
      <span className="mt-1 block font-normal text-navy/60">{busy ? "Préparation de la photo…" : previewSrc ? "Choisissez un fichier seulement pour remplacer la photo actuelle." : "JPG, PNG ou WebP."}</span>
    </div>
  );
}
