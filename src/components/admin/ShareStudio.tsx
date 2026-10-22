"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ImageDown, Link2, Loader2, MessageCircle, Music2 } from "lucide-react";
import { shareMessage, productLink, type ShareItem } from "@/lib/share-text";

type Format = "story" | "carre" | "photo";
const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "story", label: "Statut / TikTok", hint: "Vertical 9:16, avec prix, QR code et vos coordonnées" },
  { id: "carre", label: "Publication carrée", hint: "1080 × 1080, avec prix et QR code" },
  { id: "photo", label: "Photo du produit", hint: "La photo seule, sans texte" },
];

const visualUrl = (slug: string, format: Format, refSlug: string | null) => `/api/visuel/${slug}?format=${format}${refSlug ? `&ref=${refSlug}` : ""}`;

function download(file: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

const copy = (text: string) => {
  // Sans attendre : le partage qui suit doit rester dans le geste de l'utilisateur (iPhone).
  void navigator.clipboard?.writeText(text).catch(() => {});
};

/**
 * Lance le marketing d'un ou plusieurs produits : images prêtes (statut, publication, photo), puis envoi sur
 * WhatsApp (message ou statut), TikTok, enregistrement dans la galerie ou téléchargement.
 * Les images sont préparées dès le choix des produits : au clic, le partage s'ouvre tout de suite (sur iPhone,
 * un partage lancé trop tard après le geste est refusé, d'où l'ancien bouton qui « ne faisait rien »).
 */
export function ShareStudio({ items, origin, refSlug, defaultFormat = "story" }: { items: ShareItem[]; origin: string; refSlug: string | null; defaultFormat?: Format }) {
  const [format, setFormat] = useState<Format>(defaultFormat);
  const key = `${format}|${items.map((p) => p.slug).join(",")}`;
  const [prepared, setPrepared] = useState<{ key: string; files: File[]; failed: number } | null>(null);
  const ready = prepared?.key === key ? prepared : null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const defaultText = useMemo(() => shareMessage(items, origin, refSlug), [items, origin, refSlug]);
  const [edited, setEdited] = useState<{ base: string; text: string } | null>(null);
  const text = edited?.base === defaultText ? edited.text : defaultText;
  const [phone, setPhone] = useState("");
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  const target = digits.length === 9 ? `221${digits}` : digits.length >= 11 ? digits : "";
  const waUrl = `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  const tiktokText = useMemo(() => shareMessage(items, origin, refSlug, "tiktok"), [items, origin, refSlug]);

  useEffect(() => {
    // Dépend seulement de la clé (format + produits) : retaper dans la recherche ne relance pas la préparation.
    const [fmt, list] = key.split("|") as [Format, string];
    const slugs = list ? list.split(",") : [];
    if (!slugs.length) return;
    const ctrl = new AbortController();
    Promise.all(
      slugs.map(async (slug) => {
        try {
          const res = await fetch(visualUrl(slug, fmt, refSlug), { signal: ctrl.signal });
          if (!res.ok) return null;
          const blob = await res.blob();
          const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
          return new File([blob], `jamaal-${slug}-${fmt}.${ext}`, { type: blob.type || "image/png" });
        } catch {
          return null;
        }
      })
    ).then((files) => {
      if (ctrl.signal.aborted) return;
      const ok = files.filter((f): f is File => !!f);
      setPrepared({ key, files: ok, failed: files.length - ok.length });
    });
    return () => ctrl.abort();
  }, [key, refSlug]);

  if (!items.length) return null;

  const canShareFiles = (files: File[]) => typeof navigator !== "undefined" && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  async function shareFiles(files: File[], shareText: string | undefined): Promise<"ok" | "cancel" | "fail"> {
    try {
      await navigator.share(shareText ? { files, text: shareText } : { files });
      return "ok";
    } catch (e) {
      return e instanceof DOMException && e.name === "AbortError" ? "cancel" : "fail";
    }
  }

  async function onWhatsApp() {
    setMsg(null);
    const files = ready?.files ?? [];
    // Numéro du client saisi : la discussion s'ouvre directement chez lui (image enregistrée pour la joindre).
    if (canShareFiles(files) && !target) {
      copy(text);
      setBusy(true);
      const r = await shareFiles(files, text);
      setBusy(false);
      if (r === "ok") setMsg("Choisissez WhatsApp, puis une discussion ou « Mon statut ». Le texte est aussi copié : collez-le s'il n'apparaît pas.");
      if (r !== "fail") return;
    }
    files.forEach(download);
    window.open(waUrl, "_blank", "noopener");
    setMsg(files.length ? `${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} et WhatsApp ouvert avec le texte et vos liens : joignez ${files.length > 1 ? "les images" : "l'image"} (trombone 📎) ou publiez-${files.length > 1 ? "les" : "la"} en statut.` : "WhatsApp ouvert avec le texte et vos liens.");
  }

  async function onTikTok() {
    setMsg(null);
    const files = ready?.files ?? [];
    copy(tiktokText);
    if (canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, undefined);
      setBusy(false);
      if (r === "ok") setMsg("Choisissez TikTok dans la liste. La légende (avec vos hashtags et votre lien) est copiée : collez-la dans la description.");
      if (r !== "fail") return;
    }
    files.forEach(download);
    window.open("https://www.tiktok.com/upload", "_blank", "noopener");
    setMsg("Images enregistrées et TikTok ouvert : ajoutez-les à une nouvelle publication. La légende est copiée : collez-la dans la description.");
  }

  async function onGallery() {
    setMsg(null);
    const files = ready?.files ?? [];
    if (touch && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, undefined);
      setBusy(false);
      if (r === "ok") setMsg("Choisissez « Enregistrer l'image » (iPhone) ou « Galerie / Photos » (Android).");
      if (r !== "fail") return;
    }
    files.forEach(download);
    setMsg(touch ? "Images enregistrées dans les téléchargements de votre téléphone (visibles dans la galerie)." : "Images téléchargées sur votre ordinateur.");
  }

  const btn = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";
  const loading = !ready;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Format de l'image">
        {FORMATS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={format === f.id} title={f.hint} onClick={() => setFormat(f.id)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${format === f.id ? "bg-navy text-white" : "border border-line text-navy hover:bg-cream"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className={`grid gap-3 ${items.length > 1 ? "grid-cols-3 sm:grid-cols-4" : "max-w-[15rem] grid-cols-1"}`}>
        {items.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element -- image générée par le site
          <img key={`${p.slug}-${format}`} src={visualUrl(p.slug, format, refSlug)} alt={`Visuel ${p.name}`} loading="lazy" className="w-full rounded-xl border border-line bg-navy/5 object-contain" />
        ))}
      </div>

      <label className="block text-sm font-medium text-navy">
        Texte qui accompagne {items.length > 1 ? "les images" : "l'image"}
        <textarea value={text} onChange={(e) => setEdited({ base: defaultText, text: e.target.value })} rows={items.length > 1 ? 5 : 3} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm" />
      </label>

      <label className="block text-sm font-medium text-navy">
        Envoyer à un client précis (facultatif)
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro WhatsApp, ex. 77 123 45 67" className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm sm:max-w-xs" />
        <span className="mt-1 block text-xs font-normal text-navy/60">Vide : vous choisissez la discussion ou votre statut dans WhatsApp.</span>
      </label>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={onWhatsApp} disabled={busy || loading} className={`${btn} bg-[#25D366] text-white hover:bg-[#1ebe5b]`}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} WhatsApp / statut
        </button>
        <button type="button" onClick={onTikTok} disabled={busy || loading} className={`${btn} bg-black text-white hover:bg-neutral-800`}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Music2 size={16} />} TikTok
        </button>
        <button type="button" onClick={onGallery} disabled={busy || loading} className={`${btn} border border-line text-navy hover:bg-cream`}>
          <ImageDown size={16} /> Enregistrer dans la galerie
        </button>
        <button type="button" onClick={() => ready?.files.forEach(download)} disabled={busy || loading} className={`${btn} border border-line text-navy hover:bg-cream`}>
          <Download size={16} /> Télécharger {items.length > 1 ? `les ${items.length} images` : "l'image"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => { copy(text); setMsg("Texte copié."); }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold text-navy hover:bg-cream"><Copy size={14} /> Copier le texte</button>
        {items.length === 1 && (
          <button type="button" onClick={() => { copy(productLink(origin, items[0].slug, refSlug)); setMsg("Lien copié : la vente vous sera attribuée."); }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold text-navy hover:bg-cream"><Link2 size={14} /> Copier le lien</button>
        )}
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366] px-3 py-1.5 font-semibold text-[#128C4B] hover:bg-emerald-50"><MessageCircle size={14} /> Texte et lien seuls sur WhatsApp</a>
      </div>
      {loading && <p className="text-xs text-navy/65">Préparation {items.length > 1 ? "des images" : "de l'image"}…</p>}
      {ready && ready.failed > 0 && <p className="text-xs text-amber-800">{ready.failed} image(s) n&apos;ont pas pu être préparées : réessayez dans un instant.</p>}
      {msg && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>}
      <p className="text-xs text-navy/60">Les liens et le QR code portent votre code : les commandes vous sont attribuées.</p>
    </div>
  );
}
