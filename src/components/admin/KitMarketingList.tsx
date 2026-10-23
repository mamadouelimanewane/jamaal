"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Image as ImageIcon, Search, Send, X } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { priceLabel } from "@/lib/share-text";
import { ShareStudio } from "./ShareStudio";
import { useCatalogSearch } from "./useCatalogSearch";

export type KitProduct = { id: string; slug: string; name: string; shortDescription: string | null; photo: string | null; price: number | null; choganCode?: string | null; inspiredBy?: string | null; inspiredBrand?: string | null; categoryLabel?: string | null; family?: string | null; multiFormat?: boolean };

const MAX = 10;

/**
 * Kit marketing du revendeur : recherche (nom, code, parfum d'inspiration), sélection d'un ou plusieurs
 * produits, puis envoi des images sur WhatsApp (discussion ou statut), Instagram ou TikTok avec son lien.
 */
export function KitMarketingList({ products, origin, refSlug }: { products: KitProduct[]; origin: string; refSlug: string | null }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const { results } = useCatalogSearch(products, q, products.length);
  const shown = q.trim().length >= 2 ? results : products;
  const selected = picked.map((s) => products.find((p) => p.slug === s)).filter((p): p is KitProduct => !!p);
  const toggle = (slug: string) => setPicked((l) => (l.includes(slug) ? l.filter((s) => s !== slug) : l.length >= MAX ? l : [...l, slug]));
  const shareOne = (slug: string) => {
    setPicked([slug]);
    setOpen(true);
  };

  return (
    <div className="pb-24">
      <label className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5">
        <Search size={16} className="text-navy/50" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, code, parfum d'inspiration (ex. Sauvage, 021M, Aqua)"
          aria-label="Rechercher un produit"
          className="min-w-0 flex-1 text-sm outline-none"
        />
        <span className="shrink-0 text-xs text-navy/60">{shown.length} / {products.length}</span>
      </label>
      <p className="mt-2 text-xs text-navy/65">Cochez un ou plusieurs produits (jusqu&apos;à {MAX}) pour les envoyer ensemble sur WhatsApp, Instagram ou TikTok.</p>

      <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => {
          const link = `${origin}/produits/${p.slug}${refSlug ? `?ref=${refSlug}` : ""}`;
          const text = `Découvrez ${p.name}${p.inspiredBy ? ` (inspiré de ${p.inspiredBy})` : ""}${p.price ? ` — ${priceLabel(p.price, p.multiFormat)}` : ""}. Qualité premium à prix accessible ! Commandez ici : ${link}`;
          const on = picked.includes(p.slug);
          return (
            <div key={p.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${on ? "border-navy ring-2 ring-navy" : "border-line"}`}>
              <button type="button" onClick={() => toggle(p.slug)} aria-pressed={on} aria-label={`${on ? "Retirer" : "Sélectionner"} ${p.name}`} className="relative block aspect-square w-full bg-cream">
                {p.photo ? <Image src={p.photo} alt={p.name} fill className="object-cover" /> : <span className="flex h-full items-center justify-center text-navy/45"><ImageIcon size={48} /></span>}
                <span className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 ${on ? "border-navy bg-navy text-white" : "border-white bg-white/80 text-transparent"}`}><Check size={18} /></span>
              </button>
              <div className="p-4">
                <h2 className="font-semibold text-navy">{p.name}</h2>
                <p className="text-xs text-navy/60">{[p.choganCode, p.inspiredBy ? `inspiré de ${p.inspiredBy}` : null].filter(Boolean).join(" · ")}</p>
                {p.price ? <p className="mt-1 text-sm font-semibold text-navy">{priceLabel(p.price, p.multiFormat).replace(/^à/, "À")}</p> : null}
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" onClick={() => shareOne(p.slug)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90">
                    <Send size={14} /> Envoyer l&apos;image (WhatsApp, Instagram, TikTok)
                  </button>
                  <button type="button" onClick={() => toggle(p.slug)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-navy hover:bg-cream">
                    {on ? "Retirer de ma sélection" : "Ajouter à ma sélection"}
                  </button>
                  <div className="rounded-xl border border-line bg-cream/30 p-3 text-xs">
                    <p className="font-semibold text-navy/85">Texte pour statut :</p>
                    <p className="mt-1 italic text-navy/75">{text}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CopyButton text={text} label="Copier le texte" />
                      <CopyButton text={link} label="Copier le lien" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-navy/70">Aucun produit ne correspond à « {q} ».</p>}
      </div>

      {selected.length > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm text-navy"><strong>{selected.length}</strong> produit{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPicked([])} className="rounded-full px-3 py-2 text-xs font-semibold text-navy/70 hover:text-navy">Vider</button>
              <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white"><Send size={15} /> Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {open && selected.length > 0 && (
        <div role="dialog" aria-modal="true" aria-label="Envoyer les produits" className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/50 sm:items-center" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-serif-display text-lg font-semibold text-navy">Envoyer {selected.length > 1 ? `${selected.length} produits` : selected[0].name}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-2 hover:bg-cream"><X size={18} /></button>
            </div>
            <ShareStudio items={selected} origin={origin} refSlug={refSlug} />
          </div>
        </div>
      )}
    </div>
  );
}
