"use client";

import { useState } from "react";
import { Download, Film, Loader2, Share2 } from "lucide-react";
import { MediaView } from "@/components/MediaView";
import { isVideoUrl } from "@/lib/media";

function fileName(url: string, title: string) {
  const ext = url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (isVideoUrl(url) ? "mp4" : "jpg");
  const base = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "jamaal";
  return `jamaal-${base}.${ext}`;
}

/**
 * Photo ou vidéo prête à publier : aperçu, « Partager » (liste du téléphone : statut WhatsApp, TikTok,
 * Instagram…, avec le texte copié) et « Enregistrer » (galerie du téléphone ou Téléchargements).
 */
export function MediaShareCard({ src, title, text }: { src: string; title: string; text?: string }) {
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const video = isVideoUrl(src);

  async function load(): Promise<File | null> {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], fileName(src, title), { type: blob.type || (video ? "video/mp4" : "image/jpeg") });
    } catch {
      return null;
    }
  }

  function saveFile(file: File | null) {
    if (!file) {
      window.open(src, "_blank", "noopener");
      setMsg(video ? "Vidéo ouverte : touchez ⋮ ou maintenez le doigt dessus, puis « Télécharger »." : "Image ouverte : maintenez le doigt dessus, puis « Enregistrer ».");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    setMsg(video ? "Vidéo enregistrée (Galerie → Téléchargements)." : "Image enregistrée (Galerie → Téléchargements).");
  }

  async function onShare() {
    setMsg(null);
    setBusy("share");
    if (text) void navigator.clipboard?.writeText(text).catch(() => {});
    const file = await load();
    setBusy(null);
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        if (text) setMsg("Texte copié : collez-le en légende.");
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    saveFile(file);
  }

  async function onSave() {
    setMsg(null);
    setBusy("save");
    const file = await load();
    setBusy(null);
    saveFile(file);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-[4/5] bg-navy/5">
        <MediaView src={src} alt={title} fit="contain" className="h-full w-full" />
        {video && (
          <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            <Film size={12} /> Vidéo
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-navy">{title}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={onShare} disabled={!!busy} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
            {busy === "share" ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Partager
          </button>
          <button type="button" onClick={onSave} disabled={!!busy} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-navy/30 px-3 py-2 text-xs font-semibold text-navy disabled:opacity-60">
            {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Enregistrer
          </button>
        </div>
        {msg && <p role="status" className="mt-2 text-xs text-emerald-800">{msg}</p>}
      </div>
    </div>
  );
}
