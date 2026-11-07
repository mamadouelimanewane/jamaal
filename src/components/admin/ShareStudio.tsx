"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CircleDashed,
  Contact,
  Copy,
  Download,
  ImageDown,
  Link2,
  Loader2,
  MessageCircle,
  Music2,
  Search,
  UserCheck,
  Users,
  X,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { shareMessage, productLink, type ShareItem } from "@/lib/share-text";

type Format = "story" | "carre" | "photo";
const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "story", label: "Statut / TikTok", hint: "Vertical 9:16, avec prix, QR code et vos coordonnées" },
  { id: "carre", label: "Publication carrée", hint: "1080 × 1080, avec prix et QR code" },
  { id: "photo", label: "Photo du produit", hint: "La photo seule, sans texte" },
];

type Recipient = { target: string; name: string; sent: boolean };
const MAX_RECIPIENTS = 20;

/** Numéro pour wa.me : 9 chiffres sénégalais → 221…, sinon numéro international complet. */
export function waNumber(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^00/, "");
  return d.length === 9 ? `221${d}` : d.length >= 11 && d.length <= 15 ? d : "";
}

const prettyNumber = (t: string) => (t.startsWith("221") && t.length === 12 ? `${t.slice(3, 5)} ${t.slice(5, 8)} ${t.slice(8, 10)} ${t.slice(10)}` : `+${t}`);

const visualUrl = (slug: string, format: Format, refSlug: string | null) =>
  `/api/visuel/${slug}?format=${format}${refSlug ? `&ref=${refSlug}` : ""}`;

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
const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

function FacebookIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

type App = "whatsapp" | "instagram" | "tiktok" | "facebook";
const APP_LABEL: Record<App, string> = { whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };

const copy = (text: string) => {
  void navigator.clipboard?.writeText(text).catch(() => {});
};

interface ResellerClientItem {
  name: string;
  phone: string;
  lastOrder?: string;
}

/**
 * Lance le marketing d'un ou plusieurs produits : images prêtes (statut, publication, photo), puis envoi sur
 * WhatsApp (message ou statut), TikTok, Instagram, enregistrement dans la galerie ou téléchargement.
 */
export function ShareStudio({
  items,
  origin,
  refSlug,
  defaultFormat = "story",
}: {
  items: ShareItem[];
  origin: string;
  refSlug: string | null;
  defaultFormat?: Format;
}) {
  const [format, setFormat] = useState<Format>(defaultFormat);
  const key = `${format}|${items.map((p) => p.slug).join(",")}`;
  const [prepared, setPrepared] = useState<{ key: string; files: File[]; failed: number } | null>(null);
  const ready = prepared?.key === key ? prepared : null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [guide, setGuide] = useState<App | null>(null);
  const [channel, setChannel] = useState<App | null>(null);
  const [statusHelp, setStatusHelp] = useState<null | "after" | "manual" | "desktop">(null);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const defaultText = useMemo(() => shareMessage(items, origin, refSlug), [items, origin, refSlug]);
  const [edited, setEdited] = useState<{ base: string; text: string } | null>(null);
  const text = edited?.base === defaultText ? edited.text : defaultText;
  const [phone, setPhone] = useState("");
  /** Destinataires choisis (un ou plusieurs contacts). */
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Sélecteur de contact modal
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsList, setClientsList] = useState<ResellerClientItem[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  const channelBox = useRef<HTMLDivElement>(null);

  const waTo = (target: string) => `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  const tiktokText = useMemo(() => shareMessage(items, origin, refSlug, "tiktok"), [items, origin, refSlug]);
  const instaText = useMemo(() => shareMessage(items, origin, refSlug, "instagram"), [items, origin, refSlug]);
  const facebookText = useMemo(() => shareMessage(items, origin, refSlug, "facebook"), [items, origin, refSlug]);

  useEffect(() => {
    const [fmt, list] = key.split("|") as [Format, string];
    const slugs = list ? list.split(",") : [];
    if (!slugs.length) return;
    const ctrl = new AbortController();
    Promise.all(
      slugs.map(async (slug) => {
        try {
          const res = await fetch(visualUrl(slug, fmt, refSlug), { signal: ctrl.signal });
          if (!res.ok) return null;
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
      // Image manquante (réseau lent) : nouvel essai automatique, deux fois au plus.
      if (ok.length < files.length && attempt < 2) setTimeout(() => setAttempt((a) => a + 1), 1500);
    });
    return () => ctrl.abort();
  }, [key, refSlug, attempt]);

  if (!items.length) return null;

  const canShareFiles = (files: File[]) =>
    typeof navigator !== "undefined" && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  /** Vrai téléphone ou tablette (un ordinateur à écran tactile n'a pas WhatsApp « Statut » dans son partage). */
  const phoneDevice = touch && (isIos() || /android|mobile/i.test(navigator.userAgent));

  /**
   * Ouvre la liste de partage du téléphone. Le partage est lancé en premier, tant que le geste de l'utilisateur
   * est encore « frais » (Safari le refuse sinon), puis le texte est copié.
   */
  async function shareFiles(files: File[], shareText: string | undefined, clip?: string): Promise<"ok" | "cancel" | "fail"> {
    try {
      const done = navigator.share(!files.length ? { text: shareText } : shareText ? { files, text: shareText } : { files });
      if (clip) copy(clip);
      await done;
      return "ok";
    } catch (e) {
      return e instanceof DOMException && e.name === "AbortError" ? "cancel" : "fail";
    }
  }

  /**
   * Toute publication part avec l'image ET le lien : sans image prête, on ne publie pas le lien seul,
   * on relance la préparation et on prévient.
   */
  function imagesOrRetry(): File[] | null {
    const files = ready?.files ?? [];
    if (files.length) return files;
    setAttempt((a) => a + 1);
    setMsg(`${items.length > 1 ? "Les images ne sont pas encore prêtes" : "L'image n'est pas encore prête"} : nouvel essai en cours, touchez à nouveau le bouton dans un instant.`);
    return null;
  }

  /** Légende jointe à l'image : partout, sauf Instagram et TikTok sur iPhone (ils refusent image + texte ; le texte est copié). */
  const captionFor = (app: App, caption: string) => (isIos() && (app === "instagram" || app === "tiktok") ? undefined : caption);

  /** Partage direct par la liste du téléphone (si l'appli y figure). */
  async function shareDirect(app: App, caption: string) {
    const files = imagesOrRetry();
    if (!files) return;
    copy(caption);
    if (!canShareFiles(files)) return onGallery();
    setBusy(true);
    const r = await shareFiles(files, captionFor(app, caption));
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

  /** Ajoute un destinataire (numéro sénégalais à 9 chiffres ou international). */
  function addRecipient(rawPhone: string, name?: string | null): boolean {
    const target = waNumber(rawPhone);
    if (!target) {
      setMsg("Numéro incomplet : saisissez le numéro WhatsApp, par exemple 77 123 45 67.");
      return false;
    }
    setRecipients((l) => (l.some((r) => r.target === target) || l.length >= MAX_RECIPIENTS ? l : [...l, { target, name: name?.trim() || prettyNumber(target), sent: false }]));
    return true;
  }

  function addTyped() {
    if (phone.trim() && addRecipient(phone)) setPhone("");
  }

  // Ouvre le carnet du téléphone (Android Chrome) : plusieurs contacts à la fois.
  async function handleContactPicker() {
    const contactsApi = (navigator as Navigator & {
      contacts?: { select: (properties: string[], options: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
    }).contacts;
    if (!contactsApi?.select) {
      setMsg("Le carnet de contacts du téléphone n’est pas pris en charge par ce navigateur (Android avec Chrome seulement). Saisissez les numéros WhatsApp, ou touchez « Envoyer » et choisissez les contacts dans WhatsApp.");
      return;
    }
    try {
      const selected = await contactsApi.select(["name", "tel"], { multiple: true });
      let n = 0;
      for (const c of selected) if (c.tel?.[0] && addRecipient(c.tel[0], c.name?.[0])) n++;
      setMsg(n ? `${n} contact${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}.` : "Aucun numéro dans les contacts choisis.");
    } catch {
      setMsg("Sélection annulée.");
    }
  }

  // Liste interne proposée séparément du carnet du téléphone.
  async function openSavedClients() {
    setShowContactsModal(true);
    if (clientsList.length === 0) {
      setLoadingClients(true);
      try {
        const res = await fetch("/api/reseller/clients");
        if (res.ok) {
          const data = await res.json();
          setClientsList(data.clients || []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingClients(false);
      }
    }
  }

  function selectClient(c: ResellerClientItem) {
    if (addRecipient(c.phone, c.name)) setMsg(`Ajouté : ${c.name}`);
  }

  /**
   * Envoyer à un ou plusieurs contacts, toujours image + texte avec le lien :
   * - téléphone : liste de partage avec les images et le texte → WhatsApp, où l'on coche les contacts
   *   (jusqu'à 5 discussions à la fois) ;
   * - ordinateur : images téléchargées, puis une discussion par contact avec le texte (joindre l'image 📎).
   */
  async function onWhatsApp() {
    setStatusHelp(null);
    const files = imagesOrRetry();
    if (!files) return;
    if (phone.trim()) addTyped();
    if (phoneDevice && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, text, text);
      setBusy(false);
      if (r === "ok") {
        const names = recipients.map((x) => x.name);
        setMsg(names.length ? `Envoyé via WhatsApp${names.length ? ` (à cocher : ${names.join(", ")})` : ""}. Image et lien partent ensemble.` : "Envoyé : dans WhatsApp, cochez un ou plusieurs contacts (jusqu'à 5), image et lien partent ensemble.");
        return;
      }
      if (r === "cancel") return setMsg("Partage annulé.");
    }
    // Sans partage d'images (ordinateur, certains navigateurs) : image enregistrée + discussion avec le texte.
    files.forEach(download);
    setSaved(true);
    copy(text);
    const list = recipients.length ? recipients : [];
    if (list.length === 1 || (!list.length && !phoneDevice)) {
      window.open(waTo(list[0]?.target ?? ""), "_blank", "noopener");
      if (list[0]) setRecipients((l) => l.map((x) => (x.target === list[0].target ? { ...x, sent: true } : x)));
    }
    setGuide("whatsapp");
    setMsg(
      list.length > 1
        ? `${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} : ouvrez chaque discussion ci-dessous, joignez l'image (trombone 📎) et envoyez — le texte avec le lien est déjà écrit.`
        : `${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} et WhatsApp ouvert avec le texte et le lien : joignez l'image (trombone 📎) avant d'envoyer.`
    );
  }

  /**
   * Statut WhatsApp.
   * - Téléphone : liste de partage avec l'image (et, sur Android, le texte en légende) → WhatsApp → « Mon statut ».
   *   Sans partage d'images (certains navigateurs) : l'image est enregistrée et WhatsApp s'ouvre, consignes à l'écran.
   * - Ordinateur : l'image est téléchargée et WhatsApp Web s'ouvre (onglet Statut), ou code QR pour le téléphone.
   */
  async function onStatus() {
    setMsg(null);
    setGuide(null);
    setChannel(null);
    const files = imagesOrRetry();
    if (!files) return;

    if (!phoneDevice) {
      copy(text);
      if (files.length) {
        files.forEach(download);
        setSaved(true);
      }
      window.open("https://web.whatsapp.com/", "_blank", "noopener");
      return setStatusHelp("desktop");
    }

    if (canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, text, text);
      setBusy(false);
      if (r === "ok") return setStatusHelp("after");
      if (r === "cancel") {
        setStatusHelp(null);
        return setMsg("Partage annulé. Touchez à nouveau « Mettre en statut WhatsApp », puis WhatsApp → « Mon statut ».");
      }
    }

    copy(text);
    if (files.length) {
      files.forEach(download);
      setSaved(true);
    }
    setStatusHelp("manual");
  }

  /** Publier sur Instagram */
  async function onInstagram() {
    setMsg(null);
    openChannel("instagram");
    const files = imagesOrRetry();
    if (!files) return;
    copy(instaText);

    // Sur smartphone tactile avec partage natif : ouvre directement la liste avec Instagram !
    if (touch && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, captionFor("instagram", instaText));
      setBusy(false);
      if (r === "ok") {
        setMsg("✓ Visuel partagé ! Collez le texte en légende dans Instagram.");
        return;
      }
    }

    // Télécharge l'image automatiquement si non partagé directement
    if (files.length) {
      files.forEach(download);
      setSaved(true);
    }

    setMsg("✓ Texte copié & image prête ! Ouvrez Instagram pour publier.");

    // Tente d'ouvrir l'application mobile Instagram
    if (touch) {
      window.location.href = "instagram://app";
      setTimeout(() => {
        window.open("https://www.instagram.com/", "_blank", "noopener");
      }, 1000);
    } else {
      window.open("https://www.instagram.com/", "_blank", "noopener");
    }

    setTimeout(() => {
      channelBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }

  /** Publier sur TikTok */
  async function onTikTok() {
    setMsg(null);
    openChannel("tiktok");
    const files = imagesOrRetry();
    if (!files) return;
    copy(tiktokText);

    // Sur smartphone tactile avec partage natif : ouvre directement la liste avec TikTok !
    if (touch && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, captionFor("tiktok", tiktokText));
      setBusy(false);
      if (r === "ok") {
        setMsg("✓ Visuel partagé ! Collez le texte en description dans TikTok.");
        return;
      }
    }

    // Télécharge l'image automatiquement si non partagé directement
    if (files.length) {
      files.forEach(download);
      setSaved(true);
    }

    setMsg("✓ Texte copié & image prête ! Ouvrez TikTok pour publier.");

    // Tente d'ouvrir l'application mobile TikTok
    if (touch) {
      window.location.href = "snssdk1233://";
      setTimeout(() => {
        window.location.href = "tiktok://";
        setTimeout(() => {
          window.open("https://www.tiktok.com/upload", "_blank", "noopener");
        }, 800);
      }, 500);
    } else {
      window.open("https://www.tiktok.com/upload", "_blank", "noopener");
    }

    setTimeout(() => {
      channelBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }

  /** Publier sur Facebook */
  async function onFacebook() {
    setMsg(null);
    openChannel("facebook");
    const files = imagesOrRetry();
    if (!files) return;
    copy(facebookText);

    if (touch && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, captionFor("facebook", facebookText));
      setBusy(false);
      if (r === "ok") {
        setMsg("✓ Visuel partagé ! Collez le texte dans votre publication Facebook.");
        return;
      }
    }

    if (files.length) {
      files.forEach(download);
      setSaved(true);
    }

    setMsg("✓ Texte copié & image prête ! Ouvrez Facebook pour publier.");

    if (touch) {
      window.location.href = "fb://";
      setTimeout(() => {
        window.open("https://www.facebook.com/", "_blank", "noopener");
      }, 1000);
    } else {
      window.open("https://www.facebook.com/", "_blank", "noopener");
    }

    setTimeout(() => {
      channelBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }

  async function onGallery() {
    setMsg(null);
    const files = ready?.files ?? [];
    if (!files.length) return;
    if (touch && isIos() && canShareFiles(files)) {
      setBusy(true);
      const r = await shareFiles(files, undefined);
      setBusy(false);
      if (r === "ok") {
        setSaved(true);
        setMsg(
          `${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} dans Photos (si vous avez choisi « Enregistrer »).`
        );
      }
      if (r !== "fail") return;
    }
    files.forEach(download);
    setSaved(true);
    setMsg(
      touch
        ? `${files.length > 1 ? "Images enregistrées" : "Image enregistrée"} dans votre téléphone (Galerie → Téléchargements).`
        : "Images téléchargées sur votre ordinateur."
    );
  }

  const btn =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 cursor-pointer";
  const loading = !ready;

  const filteredClients = clientsList.filter((c) => {
    if (!clientSearchQuery.trim()) return true;
    const q = clientSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* ── MODAL SÉLECTION DE CONTACT ─────────────────────────────────── */}
      {showContactsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-navy" />
                <h3 className="font-serif-display text-base font-semibold text-navy">
                  Choisir parmi mes clients
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="rounded-full p-1 text-navy/50 hover:bg-cream hover:text-navy"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" size={15} />
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou numéro..."
                className="w-full rounded-xl border border-line bg-cream/30 py-2 pl-9 pr-3 text-xs text-navy outline-none focus:border-navy focus:bg-white"
              />
            </div>

            <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-line">
              {loadingClients && (
                <div className="py-8 text-center text-xs text-navy/60">
                  <Loader2 size={20} className="animate-spin mx-auto text-navy/40 mb-1" />
                  Chargement de vos clients...
                </div>
              )}

              {!loadingClients && filteredClients.length === 0 && (
                <div className="py-8 text-center text-xs text-navy/60">
                  {clientSearchQuery ? "Aucun client correspondant." : "Aucun client enregistré pour l'instant."}
                </div>
              )}

              {!loadingClients &&
                filteredClients.map((c) => (
                  <button
                    key={`${c.name}-${c.phone}`}
                    type="button"
                    onClick={() => selectClient(c)}
                    className="flex w-full items-center justify-between p-2.5 text-left transition hover:bg-cream/40"
                  >
                    <div>
                      <p className="font-semibold text-xs text-navy">{c.name}</p>
                      <p className="text-[11px] text-navy/60 font-mono">{c.phone}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${recipients.some((r) => r.target === waNumber(c.phone)) ? "bg-emerald-100 text-emerald-800" : "bg-navy/5 text-navy"}`}>
                      {recipients.some((r) => r.target === waNumber(c.phone)) ? "✓ Ajouté" : "Ajouter +"}
                    </span>
                  </button>
                ))}
            </div>

            <div className="mt-4 border-t border-line pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
              >
                {recipients.length ? `Terminé (${recipients.length})` : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHOIX DU FORMAT ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Format de l'image">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={format === f.id}
            title={f.hint}
            onClick={() => setFormat(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition cursor-pointer ${
              format === f.id ? "bg-navy text-white" : "border border-line text-navy hover:bg-cream"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── VISUELS ────────────────────────────────────────────────────── */}
      <div className={`grid gap-3 ${items.length > 1 ? "grid-cols-3 sm:grid-cols-4" : "max-w-[15rem] grid-cols-1"}`}>
        {items.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${p.slug}-${format}`}
            src={visualUrl(p.slug, format, refSlug)}
            alt={`Visuel ${p.name}`}
            loading="lazy"
            className="w-full rounded-xl border border-line bg-navy/5 object-contain"
          />
        ))}
      </div>

      {/* ── TEXTE ──────────────────────────────────────────────────────── */}
      <label className="block text-sm font-medium text-navy">
        Texte qui accompagne {items.length > 1 ? "les images" : "l'image"}
        <textarea
          value={text}
          onChange={(e) => setEdited({ base: defaultText, text: e.target.value })}
          rows={items.length > 1 ? 5 : 3}
          className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy"
        />
      </label>

      {/* ── DESTINATAIRES (un ou plusieurs) ───────────────────────────── */}
      <div>
        <label htmlFor="share-phone" className="block text-sm font-medium text-navy">
          Envoyer à un ou plusieurs clients (facultatif)
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            id="share-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTyped();
              }
            }}
            placeholder="Numéro WhatsApp, ex. 77 123 45 67"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm sm:max-w-xs outline-none focus:border-navy"
          />
          <button type="button" onClick={addTyped} disabled={!phone.trim()} className="rounded-xl bg-navy px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40">
            + Ajouter
          </button>
          <button
            type="button"
            onClick={handleContactPicker}
            className="inline-flex items-center gap-1.5 rounded-xl border border-navy/20 bg-cream/70 px-3.5 py-2 text-xs font-semibold text-navy hover:bg-cream hover:border-navy/40 transition shadow-xs cursor-pointer"
            title="Choisir un ou plusieurs contacts dans le répertoire du téléphone (Android Chrome)"
          >
            <Contact size={15} className="text-rose-dark" />
            <span>Contacts</span>
          </button>
          <button type="button" onClick={openSavedClients} className="rounded-xl border border-line px-3.5 py-2 text-xs font-semibold text-navy/75 hover:bg-cream transition">
            Mes clients du site
          </button>
        </div>

        {recipients.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Destinataires">
            {recipients.map((r) => (
              <li key={r.target} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${r.sent ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line bg-white text-navy"}`}>
                {r.sent ? <Check size={12} /> : <UserCheck size={12} />}
                {r.name}
                <button type="button" onClick={() => setRecipients((l) => l.filter((x) => x.target !== r.target))} aria-label={`Retirer ${r.name}`} className="rounded-full p-0.5 text-navy/50 hover:bg-cream hover:text-navy">
                  <X size={12} />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setRecipients([])} className="px-2 py-1 text-xs text-navy/50 hover:text-navy">Tout effacer</button>
            </li>
          </ul>
        )}
        <span className="mt-1 block text-xs font-normal text-navy/60">
          {phoneDevice
            ? "Sur le téléphone, « Envoyer » ouvre WhatsApp avec l'image et le lien : cochez les contacts (jusqu'à 5 à la fois)."
            : "Vide : vous choisissez le contact dans WhatsApp. Plusieurs contacts : une discussion par contact s'ouvre ci-dessous."}
        </span>

        {!phoneDevice && recipients.length > 1 && saved && (
          <div className="mt-2 flex flex-wrap gap-2">
            {recipients.map((r) => (
              <a
                key={r.target}
                href={waTo(r.target)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setRecipients((l) => l.map((x) => (x.target === r.target ? { ...x, sent: true } : x)))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${r.sent ? "bg-emerald-100 text-emerald-800" : "bg-[#25D366] text-white"}`}
              >
                <MessageCircle size={13} /> {r.sent ? "Ouvert" : "Ouvrir"} : {r.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── BOUTONS DE PUBLICATION / PARTAGE ───────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={onStatus}
          disabled={busy || loading}
          className={`${btn} bg-[#25D366] text-white hover:bg-[#1ebe5b] shadow-sm`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CircleDashed size={16} />} Mettre en statut WhatsApp
        </button>

        <button
          type="button"
          onClick={onWhatsApp}
          disabled={busy || loading}
          className={`${btn} border-2 border-[#25D366] text-[#128C4B] hover:bg-emerald-50`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}{" "}
          {recipients.length > 1 ? `Envoyer à ${recipients.length} contacts WhatsApp` : recipients.length === 1 ? `Envoyer à ${recipients[0].name}` : "Envoyer à des contacts WhatsApp"}
        </button>

        <button
          type="button"
          onClick={onInstagram}
          disabled={busy || loading}
          className={`${btn} bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white hover:opacity-90 shadow-sm`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Publier sur Instagram
        </button>

        <button
          type="button"
          onClick={onTikTok}
          disabled={busy || loading}
          className={`${btn} bg-black text-white hover:bg-neutral-800 shadow-sm`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Music2 size={16} />} Publier sur TikTok
        </button>

        <button
          type="button"
          onClick={onFacebook}
          disabled={busy || loading}
          className={`${btn} bg-[#1877F2] text-white hover:bg-[#166fe5] shadow-sm`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FacebookIcon size={16} />} Publier sur Facebook
        </button>
        <button
          type="button"
          onClick={onGallery}
          disabled={busy || loading}
          className={`${btn} border border-line text-navy hover:bg-cream`}
        >
          <ImageDown size={16} /> Enregistrer dans la galerie
        </button>

        <button
          type="button"
          onClick={() => ready?.files.forEach(download)}
          disabled={busy || loading}
          className={`${btn} border border-line text-navy hover:bg-cream`}
        >
          <Download size={16} /> Télécharger {items.length > 1 ? `les ${items.length} images` : "l'image"}
        </button>
      </div>

      {/* ── LIENS SECONDAIRES ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            copy(text);
            setMsg("Texte copié.");
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold text-navy hover:bg-cream cursor-pointer"
        >
          <Copy size={14} /> Copier le texte
        </button>

        {items.length === 1 && (
          <button
            type="button"
            onClick={() => {
              copy(productLink(origin, items[0].slug, refSlug));
              setMsg("Lien copié : la vente vous sera attribuée.");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold text-navy hover:bg-cream cursor-pointer"
          >
            <Link2 size={14} /> Copier le lien
          </button>
        )}

      </div>

      {loading && <p className="text-xs text-navy/65">Préparation {items.length > 1 ? "des images" : "de l'image"}…</p>}
      {ready && ready.failed > 0 && (
        <p className="text-xs text-amber-800">
          {ready.failed} image(s) n&apos;ont pas pu être préparées : réessayez dans un instant.
        </p>
      )}

      {msg && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>}

      {/* ── GUIDE AIDE INSTAGRAM / TIKTOK / WHATSAPP ───────────────────── */}
      {channel && (
        <div ref={channelBox}>
          <ChannelSteps
            app={channel}
            count={ready?.files.length ?? 0}
            saved={saved}
            busy={busy}
            ios={isIos()}
            touch={touch}
            caption={channel === "whatsapp" ? text : channel === "instagram" ? instaText : channel === "tiktok" ? tiktokText : facebookText}
            onSave={onGallery}
            onDirect={() =>
              shareDirect(channel, channel === "whatsapp" ? text : channel === "instagram" ? instaText : channel === "tiktok" ? tiktokText : facebookText)
            }
            onClose={() => setChannel(null)}
          />
        </div>
      )}

      {statusHelp && (
        <StatusSteps
          mode={statusHelp}
          count={ready?.files.length ?? 0}
          busy={busy}
          saved={saved}
          onShare={onStatus}
          onSave={onGallery}
          continueUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/admin/mon-marketing?produits=${items.map((p) => p.slug).join(",")}#partager`
              : ""
          }
          onClose={() => setStatusHelp(null)}
        />
      )}

      {guide && touch && (
        <div className="rounded-2xl border border-line bg-cream/60 p-4 text-sm text-navy">
          <p className="font-semibold">{APP_LABEL[guide]} n&apos;apparaît pas dans la liste de partage ?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Dans la liste, faites défiler la rangée d&apos;applications jusqu&apos;à <strong>« Plus »</strong> et activez{" "}
              {APP_LABEL[guide]}.
            </li>
            <li>
              Ou, en 2 temps : touchez <strong>« Enregistrer {items.length > 1 ? "les images" : "l'image"} »</strong>{" "}
              <button type="button" onClick={onGallery} className="font-semibold text-rose-dark underline">
                (ici)
              </button>
              , puis ouvrez {APP_LABEL[guide]} et ajoutez {items.length > 1 ? "les images" : "l'image"} depuis vos photos
              {guide === "whatsapp"
                ? " (Actus → Statut, ou une discussion → +)"
                : guide === "instagram"
                ? " (+ → Publication ou Story)"
                : " (+ → Photo)"}
              . Le texte est déjà copié : collez-le.
            </li>
          </ol>
          <a
            href={
              guide === "whatsapp"
                ? `whatsapp://send?text=${encodeURIComponent(text)}`
                : guide === "instagram"
                ? "instagram://app"
                : guide === "facebook" ? "fb://" : "snssdk1233://"
            }
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white ${
              guide === "whatsapp"
                ? "bg-[#25D366]"
                : guide === "instagram"
                ? "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af]"
                : guide === "facebook" ? "bg-[#1877F2]" : "bg-black"
            }`}
          >
            Ouvrir {APP_LABEL[guide]}
          </a>
        </div>
      )}

      <p className="text-xs text-navy/60">
        Les liens et le QR code portent votre code : les commandes vous sont attribuées automatiquement.
      </p>
    </div>
  );
}

const APP_STYLE: Record<App, string> = {
  whatsapp: "bg-[#25D366] text-white",
  instagram: "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  tiktok: "bg-black text-white",
  facebook: "bg-[#1877F2] text-white",
};

export function appLink(app: App, caption: string): string {
  if (app === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(caption)}`;
  if (app === "instagram") return "https://www.instagram.com/";
  if (app === "tiktok") return "https://www.tiktok.com/upload";
  return "https://www.facebook.com/";
}

const WHERE: Record<App, string> = {
  whatsapp:
    "Choisissez la discussion, puis 📎 → Galerie pour joindre l'image. Pour un statut : onglet Actus → 📷 → choisissez l'image.",
  instagram: "Touchez + → Publication ou Story, choisissez l'image dans vos photos, puis collez le texte en légende.",
  tiktok: "Touchez + → Importer, choisissez l'image, puis collez le texte en description.",
  facebook: "Touchez « Que voulez-vous dire ? » ou « Photo/Vidéo », choisissez l'image, puis collez le texte.",
};

const WHERE_DESKTOP: Record<App, string> = {
  whatsapp:
    "WhatsApp Web s'ouvre : choisissez la discussion, collez le texte, puis 📎 → Photos et vidéos → l'image dans Téléchargements.",
  instagram:
    "Sur instagram.com : Créer + → Sélectionner depuis l'ordinateur → l'image dans Téléchargements, puis collez le texte en légende.",
  tiktok:
    "Sur la page d'envoi TikTok : Sélectionner un fichier → l'image dans Téléchargements, puis collez le texte en description.",
  facebook:
    "Sur facebook.com : Créer une publication → Photo/vidéo → choisissez l'image dans Téléchargements, puis collez le texte.",
};

function ChannelSteps({
  app,
  count,
  saved,
  busy,
  ios,
  touch,
  caption,
  onSave,
  onDirect,
  onClose,
}: {
  app: App;
  count: number;
  saved: boolean;
  busy: boolean;
  ios: boolean;
  touch: boolean;
  caption: string;
  onSave: () => void;
  onDirect: () => void;
  onClose: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const label = APP_LABEL[app];

  const handleOpenApp = () => {
    copy(caption);
    setOpened(true);
    if (app === "instagram" && touch) {
      window.location.href = "instagram://app";
      setTimeout(() => {
        window.open("https://www.instagram.com/", "_blank", "noopener");
      }, 1000);
      return;
    }
    if (app === "facebook" && touch) {
      window.location.href = "fb://";
      setTimeout(() => {
        window.open("https://www.facebook.com/", "_blank", "noopener");
      }, 1000);
      return;
    }
    if (app === "tiktok" && touch) {
      window.location.href = "snssdk1233://";
      setTimeout(() => {
        window.location.href = "tiktok://";
        setTimeout(() => {
          window.open("https://www.tiktok.com/upload", "_blank", "noopener");
        }, 800);
      }, 500);
      return;
    }
    window.open(appLink(app, caption), "_blank", "noopener");
  };

  return (
    <div className="rounded-2xl border-2 border-navy/15 bg-white p-4 text-sm text-navy shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Publier sur {label} en 2 étapes</p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-navy/60 hover:text-navy cursor-pointer">
          Fermer
        </button>
      </div>

      <ol className="mt-3 space-y-3">
        <li className="rounded-xl bg-cream/60 p-3">
          <p className="font-medium">
            1. Enregistrez {count > 1 ? `les ${count} images` : "l'image"}{" "}
            {touch ? "dans votre téléphone" : "sur l'ordinateur (Téléchargements)"}
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={busy || !count}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-60 sm:w-auto cursor-pointer"
          >
            {saved
              ? "✓ Enregistrée" + (count > 1 ? "s" : "") + " · enregistrer à nouveau"
              : `Enregistrer ${count > 1 ? "les images" : "l'image"}`}
          </button>
          {ios && (
            <p className="mt-1.5 text-xs text-navy/65">
              Dans la liste qui s&apos;ouvre, choisissez <strong>« Enregistrer l&apos;image »</strong> (ou « Enregistrer{" "}
              {count > 1 ? `${count} images` : "l'image"} »).
            </p>
          )}
        </li>

        <li className="rounded-xl bg-cream/60 p-3">
          <p className="font-medium">2. Ouvrez {label} : le texte est copié, collez-le</p>
          <button
            type="button"
            onClick={handleOpenApp}
            className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 font-semibold sm:w-auto cursor-pointer ${APP_STYLE[app]}`}
          >
            Ouvrir {label}
          </button>
          <p className="mt-1.5 text-xs text-navy/65">{touch ? WHERE[app] : WHERE_DESKTOP[app]}</p>
          {opened && <p className="mt-1.5 text-xs font-semibold text-emerald-800">Texte copié dans le presse-papier ✓</p>}
        </li>
      </ol>

      {touch && (
        <button
          type="button"
          onClick={onDirect}
          disabled={busy || !count}
          className="mt-3 text-xs font-semibold text-navy/60 underline hover:text-navy cursor-pointer"
        >
          Ou partager directement (si {label} apparaît dans la liste de votre téléphone)
        </button>
      )}
    </div>
  );
}

function StatusSteps({
  mode,
  count,
  busy,
  saved,
  onShare,
  onSave,
  continueUrl,
  onClose,
}: {
  mode: "after" | "manual" | "desktop";
  count: number;
  busy: boolean;
  saved: boolean;
  onShare: () => void;
  onSave: () => void;
  continueUrl: string;
  onClose: () => void;
}) {
  const img = count > 1 ? "les images" : "l'image";
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [mode]);

  return (
    <div
      ref={box}
      className="scroll-mb-6 rounded-2xl border-2 border-[#25D366]/40 bg-white p-4 text-sm text-navy shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Publier le produit en statut WhatsApp</p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-navy/60 hover:text-navy cursor-pointer">
          Fermer
        </button>
      </div>

      {mode === "after" && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>
            Dans WhatsApp, touchez <strong>« Mon statut »</strong> (tout en haut de la liste), puis la flèche d&apos;envoi.
          </li>
          <li>
            Avant d&apos;envoyer, touchez la légende et <strong>collez le texte</strong> (il est déjà copié, avec votre
            lien).
          </li>
          <li className="text-navy/70">
            WhatsApp n&apos;était pas dans la liste ?{" "}
            <button type="button" onClick={onSave} className="font-semibold text-rose-dark underline cursor-pointer">
              Enregistrez {img}
            </button>
            , puis WhatsApp → <strong>Actus</strong> → 📷 → choisissez {img} dans la galerie.
          </li>
        </ol>
      )}

      {mode === "manual" && (
        <ol className="mt-3 space-y-3">
          <li className="rounded-xl bg-cream/60 p-3">
            <p className="font-medium">1. Enregistrez {img} dans votre téléphone</p>
            <button
              type="button"
              onClick={onSave}
              disabled={busy || !count}
              className="mt-2 rounded-full bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {saved ? "✓ Enregistrée · enregistrer à nouveau" : `Enregistrer ${img}`}
            </button>
          </li>
          <li className="rounded-xl bg-cream/60 p-3">
            <p className="font-medium">
              2. Ouvrez WhatsApp → onglet <strong>Actus</strong> → 📷, choisissez {img}, collez le texte en légende
            </p>
            <a
              href="whatsapp://"
              className="mt-2 inline-flex rounded-full bg-[#25D366] px-4 py-2.5 font-semibold text-white cursor-pointer"
            >
              Ouvrir WhatsApp
            </a>
            <button
              type="button"
              onClick={onShare}
              className="ml-3 text-xs font-semibold text-navy/60 underline cursor-pointer"
            >
              Réessayer le partage direct
            </button>
          </li>
        </ol>
      )}

      {mode === "desktop" && (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="shrink-0 rounded-xl border border-line bg-white p-2">
            <QRCodeSVG value={continueUrl || "https://www.jamaal.sn"} size={132} />
          </div>
          <div>
            <p className="font-medium">Depuis l&apos;ordinateur (WhatsApp Web, ouvert dans un nouvel onglet) :</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-navy/80">
              <li>
                {count ? (
                  <>
                    {count > 1 ? "Les images sont" : "L'image est"} dans <strong>Téléchargements</strong> (
                    <button type="button" onClick={onSave} className="font-semibold text-rose-dark underline cursor-pointer">
                      télécharger à nouveau
                    </button>
                    ).
                  </>
                ) : (
                  <>Préparation de {img}… touchez à nouveau le bouton dans un instant.</>
                )}
              </li>
              <li>
                Dans WhatsApp Web, cliquez l&apos;icône <strong>Statut</strong> (le cercle, à gauche), puis <strong>+</strong> →{" "}
                <strong>Photos et vidéos</strong> et choisissez {img}.
              </li>
              <li>Collez le texte en légende (il est déjà copié, avec votre lien), puis envoyez.</li>
            </ol>
            <p className="mt-2 text-xs text-navy/60">
              Plus simple sur le téléphone : scannez ce code avec l&apos;appareil photo, le même produit s&apos;ouvre dans
              votre espace, touchez alors « Mettre en statut WhatsApp ».
            </p>
            <a
              href="https://web.whatsapp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
            >
              Ouvrir WhatsApp Web
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
