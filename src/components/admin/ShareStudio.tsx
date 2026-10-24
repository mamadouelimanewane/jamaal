"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CircleDashed, Copy, Download, ImageDown, Link2, Loader2, MessageCircle, Music2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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


/** Convertit une image en JPEG (fond blanc) ; renvoie l'original si le navigateur ne sait pas le faire. */
async function toJpeg(blob: Blob): Promise<Blob> {
  if (blob.type === "image/jpeg") return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    return out ?? blob;
  } catch {
    return blob;
  }
}

/** iPhone / iPad : la liste de partage masque certaines applis quand un texte accompagne les images. */
const isIos = () => typeof navigator !== "undefined" && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

type App = "whatsapp" | "instagram" | "tiktok";
const APP_LABEL: Record<App, string> = { whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok" };

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
  const [guide, setGuide] = useState<App | null>(null);
  // Parcours en 2 étapes (enregistrer les images, puis ouvrir l'appli) : ne dépend pas de la liste de partage du téléphone.
  const [channel, setChannel] = useState<App | null>(null);
  // Statut WhatsApp : aide affichée après le partage (ou à la place, sur ordinateur).
  const [statusHelp, setStatusHelp] = useState<null | "after" | "manual" | "desktop">(null);
  const [saved, setSaved] = useState(false);
  const defaultText = useMemo(() => shareMessage(items, origin, refSlug), [items, origin, refSlug]);
  const [edited, setEdited] = useState<{ base: string; text: string } | null>(null);
  const text = edited?.base === defaultText ? edited.text : defaultText;
  const [phone, setPhone] = useState("");
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  const target = digits.length === 9 ? `221${digits}` : digits.length >= 11 ? digits : "";
  const waUrl = `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  const tiktokText = useMemo(() => shareMessage(items, origin, refSlug, "tiktok"), [items, origin, refSlug]);
  const instaText = useMemo(() => shareMessage(items, origin, refSlug, "instagram"), [items, origin, refSlug]);

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
          // En JPEG : c'est le format que WhatsApp, Instagram et TikTok acceptent partout dans la liste de partage.
          const blob = await toJpeg(await res.blob());
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

  /** Partage direct par la liste du téléphone (si l'appli y figure). */
  async function shareDirect(app: App, caption: string) {
    const files = ready?.files ?? [];
    copy(caption);
    if (!canShareFiles(files)) return onGallery();
    setBusy(true);
    const r = await shareFiles(files, !isIos() && app === "whatsapp" ? caption : undefined);
    setBusy(false);
    if (r === "ok") setMsg(`Texte copié : collez-le dans ${APP_LABEL[app]}.`);
    if (r === "fail") await onGallery();
  }

  function openChannel(app: App) {
    setStatusHelp(null);
    setMsg(null);
    setGuide(null);
    setSaved(false);
    setChannel(app);
  }

  async function onWhatsApp() {
    // Numéro du client saisi : discussion ouverte directement chez lui (l'image est enregistrée pour la joindre).
    if (target) {
      const files = ready?.files ?? [];
      files.forEach(download);
      window.open(waUrl, "_blank", "noopener");
      setGuide("whatsapp");
      setMsg(files.length ? "Image enregistrée et discussion WhatsApp ouverte avec le texte : joignez l'image (trombone 📎)." : "WhatsApp ouvert avec le texte et vos liens.");
      return;
    }
    openChannel("whatsapp");
  }
  /**
   * Statut WhatsApp. Aucun lien ne publie directement un statut : sur téléphone, on partage l'IMAGE SEULE vers
   * WhatsApp, qui propose alors « Mon statut » en tête de liste ; le texte est copié pour la légende. Sans partage
   * possible : enregistrer l'image puis WhatsApp › Actus. Sur ordinateur : le statut se publie depuis le téléphone.
   */
  async function onStatus() {
    setMsg(null);
    setGuide(null);
    setChannel(null);
    copy(text);
    const files = ready?.files ?? [];
    if (!touch) return setStatusHelp("desktop");
    if (canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, undefined);
      setBusy(false);
      if (r === "ok") return setStatusHelp("after");
      if (r === "cancel") return setStatusHelp(null);
    }
    setStatusHelp("manual");
  }
  const onInstagram = () => openChannel("instagram");
  const onTikTok = () => openChannel("tiktok");

  async function onGallery() {
    setMsg(null);
    const files = ready?.files ?? [];
    if (!files.length) return;
    // iPhone : « Enregistrer l'image » est toujours dans la liste de partage (les téléchargements vont dans Fichiers, pas Photos).
    if (touch && isIos() && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, undefined);
      setBusy(false);
      if (r === "ok") {
        setSaved(true);
        setMsg(`${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} dans Photos (si vous avez choisi « Enregistrer »).`);
      }
      if (r !== "fail") return;
    }
    // Android et ordinateur : téléchargement direct, visible dans la galerie et dans WhatsApp, Instagram, TikTok.
    files.forEach(download);
    setSaved(true);
    setMsg(touch ? `${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} dans votre téléphone (Galerie › Téléchargements).` : "Images téléchargées sur votre ordinateur.");
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
        <span className="mt-1 block text-xs font-normal text-navy/60">Vide : vous choisissez le contact dans WhatsApp. Pour un statut, touchez « Mettre en statut WhatsApp ».</span>
      </label>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={onStatus} disabled={busy || loading} className={`${btn} bg-[#25D366] text-white hover:bg-[#1ebe5b]`}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CircleDashed size={16} />} Mettre en statut WhatsApp
        </button>
        <button type="button" onClick={onWhatsApp} disabled={busy || loading} className={`${btn} border-2 border-[#25D366] text-[#128C4B] hover:bg-emerald-50`}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} Envoyer à un contact WhatsApp
        </button>
        <button type="button" onClick={onInstagram} disabled={busy || loading} className={`${btn} bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white hover:opacity-90`}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Instagram
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
      {statusHelp && (
        <StatusSteps
          mode={statusHelp}
          count={ready?.files.length ?? 0}
          busy={busy}
          saved={saved}
          onShare={onStatus}
          onSave={onGallery}
          continueUrl={typeof window !== "undefined" ? `${window.location.origin}/admin/mon-marketing?produits=${items.map((p) => p.slug).join(",")}#partager` : ""}
          onClose={() => setStatusHelp(null)}
        />
      )}
      {channel && (
        <ChannelSteps
          app={channel}
          count={ready?.files.length ?? 0}
          saved={saved}
          busy={busy}
          ios={isIos()}
          touch={touch}
          caption={channel === "whatsapp" ? text : channel === "instagram" ? instaText : tiktokText}
          onSave={onGallery}
          onDirect={() => shareDirect(channel, channel === "whatsapp" ? text : channel === "instagram" ? instaText : tiktokText)}
          onClose={() => setChannel(null)}
        />
      )}
      {msg && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>}
      {guide && touch && (
        <div className="rounded-2xl border border-line bg-cream/60 p-4 text-sm text-navy">
          <p className="font-semibold">{APP_LABEL[guide]} n&apos;apparaît pas dans la liste de partage ?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Dans la liste, faites défiler la rangée d&apos;applications jusqu&apos;à <strong>« Plus »</strong> et activez {APP_LABEL[guide]}.</li>
            <li>Ou, en 2 temps : touchez <strong>« Enregistrer {items.length > 1 ? "les images" : "l'image"} »</strong>{" "}
              <button type="button" onClick={onGallery} className="font-semibold text-rose-dark underline">(ici)</button>, puis ouvrez {APP_LABEL[guide]} et ajoutez {items.length > 1 ? "les images" : "l'image"} depuis vos photos
              {guide === "whatsapp" ? " (Actus › Statut, ou une discussion › +)" : guide === "instagram" ? " (+ › Publication ou Story)" : " (+ › Photo)"}. Le texte est déjà copié : collez-le.</li>
          </ol>
          <a
            href={guide === "whatsapp" ? `whatsapp://send?text=${encodeURIComponent(text)}` : guide === "instagram" ? "instagram://app" : "https://www.tiktok.com/"}
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white ${guide === "whatsapp" ? "bg-[#25D366]" : guide === "instagram" ? "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af]" : "bg-black"}`}
          >
            Ouvrir {APP_LABEL[guide]}
          </a>
        </div>
      )}
      <p className="text-xs text-navy/60">Les liens et le QR code portent votre code : les commandes vous sont attribuées.</p>
    </div>
  );
}

const APP_STYLE: Record<App, string> = {
  whatsapp: "bg-[#25D366] text-white",
  instagram: "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  tiktok: "bg-black text-white",
};
/** Lien qui ouvre l'application (lien universel : l'appli si elle est installée, sinon le site). */
export function appLink(app: App, caption: string): string {
  if (app === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(caption)}`;
  if (app === "instagram") return "https://www.instagram.com/";
  return "https://www.tiktok.com/upload";
}
const WHERE: Record<App, string> = {
  whatsapp: "Choisissez la discussion, puis 📎 › Galerie pour joindre l'image. Pour un statut : onglet Actus › ➕ › choisissez l'image.",
  instagram: "Touchez ➕ › Publication ou Story, choisissez l'image dans vos photos, puis collez le texte en légende.",
  tiktok: "Touchez ➕ › Importer, choisissez l'image, puis collez le texte en description.",
};
/** Sur ordinateur (Mac, PC) : versions web, l'image vient du dossier Téléchargements. */
const WHERE_DESKTOP: Record<App, string> = {
  whatsapp: "WhatsApp Web (ou l'application WhatsApp de l'ordinateur) s'ouvre : choisissez la discussion, collez le texte, puis 📎 › Photos et vidéos › l'image dans Téléchargements.",
  instagram: "Sur instagram.com : Créer ➕ › Sélectionner depuis l'ordinateur › l'image dans Téléchargements, puis collez le texte en légende.",
  tiktok: "Sur la page d'envoi TikTok : Sélectionner un fichier › l'image dans Téléchargements, puis collez le texte en description.",
};

/** Publier sur une appli en 2 étapes : 1. enregistrer les images dans le téléphone, 2. ouvrir l'appli (texte copié). */
function ChannelSteps({ app, count, saved, busy, ios, touch, caption, onSave, onDirect, onClose }: { app: App; count: number; saved: boolean; busy: boolean; ios: boolean; touch: boolean; caption: string; onSave: () => void; onDirect: () => void; onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  const label = APP_LABEL[app];
  return (
    <div className="rounded-2xl border-2 border-navy/15 bg-white p-4 text-sm text-navy shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Publier sur {label} en 2 étapes</p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-navy/60 hover:text-navy">Fermer</button>
      </div>
      <ol className="mt-3 space-y-3">
        <li className="rounded-xl bg-cream/60 p-3">
          <p className="font-medium">1. Enregistrez {count > 1 ? `les ${count} images` : "l'image"} {touch ? "dans votre téléphone" : "sur l'ordinateur (Téléchargements)"}</p>
          <button type="button" onClick={onSave} disabled={busy || !count} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-60 sm:w-auto">
            {saved ? "✓ Enregistrée" + (count > 1 ? "s" : "") + " — enregistrer à nouveau" : `Enregistrer ${count > 1 ? "les images" : "l'image"}`}
          </button>
          {ios && <p className="mt-1.5 text-xs text-navy/65">Dans la liste qui s&apos;ouvre, choisissez <strong>« Enregistrer l&apos;image »</strong> (ou « Enregistrer {count > 1 ? `${count} images` : "l'image"} »).</p>}
        </li>
        <li className="rounded-xl bg-cream/60 p-3">
          <p className="font-medium">2. Ouvrez {label} : le texte est copié, collez-le</p>
          <a href={appLink(app, caption)} target="_blank" rel="noopener noreferrer" onClick={() => { copy(caption); setOpened(true); }} className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 font-semibold sm:w-auto ${APP_STYLE[app]}`}>
            Ouvrir {label}
          </a>
          <p className="mt-1.5 text-xs text-navy/65">{touch ? WHERE[app] : WHERE_DESKTOP[app]}</p>
          {opened && <p className="mt-1.5 text-xs font-semibold text-emerald-800">Texte copié ✓</p>}
        </li>
      </ol>
      {touch && (
        <button type="button" onClick={onDirect} disabled={busy || !count} className="mt-3 text-xs font-semibold text-navy/60 underline hover:text-navy">
          Ou partager directement (si {label} apparaît dans la liste de votre téléphone)
        </button>
      )}
    </div>
  );
}

/** Aide au statut WhatsApp : après le partage, sans partage possible, ou sur ordinateur (continuer sur le téléphone). */
function StatusSteps({ mode, count, busy, saved, onShare, onSave, continueUrl, onClose }: { mode: "after" | "manual" | "desktop"; count: number; busy: boolean; saved: boolean; onShare: () => void; onSave: () => void; continueUrl: string; onClose: () => void }) {
  const img = count > 1 ? "les images" : "l'image";
  const box = useRef<HTMLDivElement>(null);
  // Sur téléphone, l'aide est sous les boutons : on l'amène à l'écran.
  useEffect(() => box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [mode]);
  return (
    <div ref={box} className="scroll-mb-6 rounded-2xl border-2 border-[#25D366]/40 bg-white p-4 text-sm text-navy shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Publier le produit en statut WhatsApp</p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-navy/60 hover:text-navy">Fermer</button>
      </div>
      {mode === "after" && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Dans WhatsApp, touchez <strong>« Mon statut »</strong> (tout en haut de la liste), puis la flèche d&apos;envoi.</li>
          <li>Avant d&apos;envoyer, touchez la légende et <strong>collez le texte</strong> (il est déjà copié, avec votre lien).</li>
          <li className="text-navy/70">WhatsApp n&apos;était pas dans la liste ? <button type="button" onClick={onSave} className="font-semibold text-rose-dark underline">Enregistrez {img}</button>, puis WhatsApp › <strong>Actus</strong> › 📷 › choisissez {img} dans la galerie.</li>
        </ol>
      )}
      {mode === "manual" && (
        <ol className="mt-3 space-y-3">
          <li className="rounded-xl bg-cream/60 p-3">
            <p className="font-medium">1. Enregistrez {img} dans votre téléphone</p>
            <button type="button" onClick={onSave} disabled={busy || !count} className="mt-2 rounded-full bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-60">{saved ? "✓ Enregistrée — enregistrer à nouveau" : `Enregistrer ${img}`}</button>
          </li>
          <li className="rounded-xl bg-cream/60 p-3">
            <p className="font-medium">2. Ouvrez WhatsApp › onglet <strong>Actus</strong> › 📷, choisissez {img}, collez le texte en légende</p>
            <a href="whatsapp://" className="mt-2 inline-flex rounded-full bg-[#25D366] px-4 py-2.5 font-semibold text-white">Ouvrir WhatsApp</a>
            <button type="button" onClick={onShare} className="ml-3 text-xs font-semibold text-navy/60 underline">Réessayer le partage direct</button>
          </li>
        </ol>
      )}
      {mode === "desktop" && (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="shrink-0 rounded-xl border border-line bg-white p-2"><QRCodeSVG value={continueUrl || "https://www.jamaal.sn"} size={132} /></div>
          <div>
            <p>Le statut WhatsApp se publie <strong>depuis votre téléphone</strong>.</p>
            <p className="mt-1 text-navy/70">Scannez ce code avec l&apos;appareil photo du téléphone : le même produit s&apos;ouvre dans votre espace, touchez alors « Mettre en statut WhatsApp ».</p>
            <p className="mt-1 text-xs text-navy/60">Texte déjà copié. Autre solution : <button type="button" onClick={onSave} className="font-semibold text-rose-dark underline">téléchargez {img}</button> et envoyez-{count > 1 ? "les" : "la"} sur votre téléphone.</p>
          </div>
        </div>
      )}
    </div>
  );
}
