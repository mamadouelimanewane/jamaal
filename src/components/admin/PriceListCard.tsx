"use client";

import { useState } from "react";
import { Download, Eye, FileText, Loader2, Share2 } from "lucide-react";

/**
 * Liste de prix PDF, en haut de la page Produits du revendeur : la consulter, l'enregistrer sur le
 * téléphone, ou l'envoyer à un client sur WhatsApp (le fichier lui-même, sinon son lien).
 */
export function PriceListCard({ url, title, updatedAt }: { url: string; title: string; updatedAt: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileName = `${title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  const date = updatedAt ? new Date(`${updatedAt}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

  async function onShare() {
    setMsg(null);
    const link = new URL(url, window.location.origin).toString();
    const text = `${title} : ${link}`;
    setBusy(true);
    try {
      const res = await fetch(url);
      const blob = res.ok ? await res.blob() : null;
      const file = blob ? new File([blob], fileName, { type: "application/pdf" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      setBusy(false);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setMsg("WhatsApp s'ouvre avec le lien de la liste de prix.");
  }

  return (
    <section aria-labelledby="price-list-title" className="flex flex-col gap-4 rounded-2xl border border-[#d9b98a] bg-gradient-to-br from-[#2b2421] to-[#3d322c] p-5 text-white sm:flex-row sm:items-center">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#d9b98a] text-[#2b2421]">
        <FileText size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="price-list-title" className="font-serif-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-white/75">Tous les produits JAMAAL avec leurs prix en francs CFA, à consulter ou à envoyer aux clients{date ? ` · mise à jour du ${date}` : ""}.</p>
        {msg && <p role="status" className="mt-1 text-xs text-[#f3dcb8]">{msg}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex">
        <a href={url} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#d9b98a] px-4 py-2.5 text-sm font-semibold text-[#2b2421]">
          <Eye size={16} /> Voir
        </a>
        <a href={url} download={fileName} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/40 px-4 py-2.5 text-sm font-semibold">
          <Download size={16} /> Enregistrer
        </a>
        <button type="button" onClick={onShare} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Envoyer
        </button>
      </div>
    </section>
  );
}
