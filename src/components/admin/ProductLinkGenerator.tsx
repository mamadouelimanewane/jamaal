"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";

type P = { slug: string; name: string; price: number | null };

/** Génère un lien produit qui attribue automatiquement la vente au revendeur (?ref=). */
export function ProductLinkGenerator({ products, origin, refSlug }: { products: P[]; origin: string; refSlug: string | null }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<P | null>(null);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t.length < 2 ? [] : products.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, products]);
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
        placeholder="Rechercher un produit (ex. Amphera, gel douche, café…)"
        className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-rose-dark"
      />
      {!picked && results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white text-sm">
          {results.map((p) => (
            <li key={p.slug}>
              <button type="button" onClick={() => setPicked(p)} className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-cream">
                <span className="text-navy">{p.name}</span>
                {p.price != null && <span className="shrink-0 text-xs text-navy/50">{p.price.toLocaleString("fr-FR")} FCFA</span>}
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
              <MessageCircle size={13} /> Partager sur WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
