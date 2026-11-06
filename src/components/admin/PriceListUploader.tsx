"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { uploadMedia } from "@/lib/media-upload";
import { setPriceList } from "@/lib/actions/price-list";

/** Back-office : remplacer la liste de prix PDF montrée aux revendeurs (page Produits). */
export function PriceListUploader({ current }: { current: { url: string; title: string; updatedAt: string } }) {
  const [title, setTitle] = useState(current.title);
  const [percent, setPercent] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    setPercent(0);
    try {
      const url = await uploadMedia(file, "tarifs", setPercent);
      const r = await setPriceList(url, title);
      setMsg(r.ok ? { ok: true, text: "Nouvelle liste de prix en ligne pour tous les revendeurs." } : { ok: false, text: r.error ?? "Échec." });
      if (r.ok) router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Envoi impossible." });
    } finally {
      setPercent(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5" aria-labelledby="pl-title">
      <h2 id="pl-title" className="font-semibold text-navy">Liste de prix des revendeurs (PDF)</h2>
      <p className="mt-1 text-sm text-navy/70">
        Affichée en haut de la page Produits de chaque revendeur. Actuelle :{" "}
        <a href={current.url} target="_blank" rel="noopener" className="font-semibold text-rose-dark underline">{current.title}</a>
        {current.updatedAt ? ` (du ${new Date(`${current.updatedAt}T12:00:00`).toLocaleDateString("fr-FR")})` : ""}.
      </p>
      <label className="mt-3 block text-sm font-medium text-navy">
        Titre de la nouvelle liste
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy" />
      </label>
      <label className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white ${percent !== null ? "pointer-events-none opacity-70" : ""}`}>
        {percent !== null ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
        {percent !== null ? `Envoi… ${percent} %` : "Remplacer par un autre PDF"}
        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-emerald-800" : "text-rose-dark"}`}>{msg.text}</p>}
    </section>
  );
}
