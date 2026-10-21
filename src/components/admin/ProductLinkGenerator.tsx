"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { findProducts, inspirationLabel } from "@/lib/product-finder";

type P = { slug: string; name: string; price: number | null; choganCode?: string | null; inspiredBy?: string | null; inspiredBrand?: string | null };

/** Génère un lien produit qui attribue automatiquement la vente au consultant (?ref=). */
export function ProductLinkGenerator({ products, origin, refSlug }: { products: P[]; origin: string; refSlug: string | null }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<P | null>(null);
  const results = useMemo(() => findProducts(products, q, 8), [q, products]);
  const link = picked ? `${origin}/produits/${picked.slug}${refSlug ? `?ref=${refSlug}` : ""}` : "";
  const message = picked ? `${picked.name}${picked.price ? ` — ${picked.price.toLocaleString("fr-FR")} FCFA` : ""}. Commande ici : ${link}` : "";

  return (
    <div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPicked(null);
        }}
        type="search"
        aria-label="Rechercher un produit"
        placeholder="Nom, code ou parfum (ex. Sauvage)"
        className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-rose-dark"
      />
      {!picked && q.trim().length >= 2 && results.length === 0 && <p className="mt-2 text-sm text-navy/70">Aucun produit trouvé : essayez le code (ex. 021M) ou un autre mot.</p>}
      {!picked && results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white text-sm">
          {results.map((p) => (
            <li key={p.slug}>
              <button type="button" onClick={() => setPicked(p)} className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-cream">
                <span className="min-w-0">
                  <span className="block text-navy">{p.name}</span>
                  {(p.choganCode || p.inspiredBy) && (
                    <span className="block truncate text-xs text-navy/60">{[p.choganCode, inspirationLabel(p)].filter(Boolean).join(" · ")}</span>
                  )}
                </span>
                {p.price != null && <span className="shrink-0 text-xs text-navy/70">{p.price.toLocaleString("fr-FR")} FCFA</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <div className="mt-3 rounded-xl border border-line bg-cream p-4">
          <p className="text-sm font-semibold text-navy">{picked.name}</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-xs" />
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={link} label="Copier le lien" />
            <CopyButton text={message} label="Copier le message" />
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              <MessageCircle size={13} /> Envoyer sur WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
