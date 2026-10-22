"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Download, Image as ImageIcon, MessageCircle, Search } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { useCatalogSearch } from "./useCatalogSearch";

export type KitProduct = { id: string; slug: string; name: string; shortDescription: string | null; photo: string | null; price: number | null; choganCode?: string | null; inspiredBy?: string | null; inspiredBrand?: string | null; categoryLabel?: string | null; family?: string | null };

/** Kit marketing du revendeur : recherche de produits, texte prêt à publier et partage direct sur WhatsApp avec son lien. */
export function KitMarketingList({ products, origin, refSlug }: { products: KitProduct[]; origin: string; refSlug: string | null }) {
  const [q, setQ] = useState("");
  const { results } = useCatalogSearch(products, q, products.length);
  const shown = q.trim().length >= 2 ? results : products;

  return (
    <div>
      <label className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5">
        <Search size={16} className="text-navy/50" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, code ou catégorie (ex. Sauvage, 021M, parfum femme)"
          aria-label="Rechercher un produit"
          className="min-w-0 flex-1 text-sm outline-none"
        />
        <span className="shrink-0 text-xs text-navy/60">{shown.length} / {products.length}</span>
      </label>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => {
          const link = `${origin}/produits/${p.slug}${refSlug ? `?ref=${refSlug}` : ""}`;
          const text = `Découvrez ${p.name}${p.price ? ` — ${p.price.toLocaleString("fr-FR")} FCFA` : ""}. Qualité premium à prix accessible ! Commandez ici : ${link}`;
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="relative aspect-square w-full bg-cream">
                {p.photo ? (
                  <Image src={p.photo} alt={p.name} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-navy/45"><ImageIcon size={48} /></div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-navy">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-navy/75">{p.shortDescription}</p>
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <MessageCircle size={14} /> Partager sur WhatsApp
                  </a>
                  <Link href={`/admin/catalogue/${p.slug}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-navy transition hover:bg-cream">
                    Visuels, TikTok et galerie →
                  </Link>
                  {p.photo && (
                    <a href={p.photo} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-navy transition hover:bg-line">
                      <Download size={14} /> Télécharger la photo
                    </a>
                  )}
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
    </div>
  );
}
