"use client";

import { useRef, useState } from "react";
import { Download, Printer } from "lucide-react";

/**
 * Mini-catalogue partageable.
 * - Impression navigateur → PDF
 * - Export image (html-to-image) si la lib est dispo
 */
export function CatalogShareCard({
  consultantName,
  city,
  personalLink,
  whatsapp,
  products,
}: {
  consultantName: string;
  city: string;
  personalLink: string;
  whatsapp?: string | null;
  products: {
    name: string;
    shortDescription: string;
    priceLabel: string;
    category: string;
  }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  function printCatalog() {
    window.print();
  }

  async function exportPng() {
    if (!ref.current) return;
    setExporting(true);
    try {
      // html-to-image est déjà une dépendance du projet
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.download = `catalogue-jamaal-${consultantName.toLowerCase().replace(/\s+/g, "-")}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      // fallback impression
      window.print();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={printCatalog}
          className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          <Printer size={16} />
          Imprimer / PDF
        </button>
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          className="flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          <Download size={16} />
          {exporting ? "Export…" : "Télécharger image"}
        </button>
      </div>

      <div
        ref={ref}
        className="rounded-2xl border border-line bg-white p-6 shadow-sm print:border-0 print:shadow-none"
      >
        <header className="border-b border-line pb-4 text-center">
          <p className="font-serif-display text-2xl font-semibold tracking-wide text-navy">
            JAMAAL
          </p>
          <p className="mt-1 text-xs uppercase tracking-widest text-rose-dark">
            Luxury Cosmetics
          </p>
          <p className="mt-3 text-sm font-semibold text-navy">{consultantName}</p>
          <p className="text-xs text-navy/50">{city}</p>
        </header>

        <ul className="mt-4 divide-y divide-line">
          {products.slice(0, 12).map((p, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{p.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-navy/60">{p.shortDescription}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-navy/40">{p.category}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-navy">{p.priceLabel}</p>
            </li>
          ))}
        </ul>

        {products.length > 12 && (
          <p className="mt-2 text-center text-xs text-navy/40">
            + {products.length - 12} autres produits sur le site
          </p>
        )}

        <footer className="mt-6 border-t border-line pt-4 text-center">
          <p className="text-xs text-navy/60">Commander via mon lien</p>
          <p className="mt-1 break-all text-sm font-semibold text-navy">{personalLink}</p>
          {whatsapp && (
            <p className="mt-2 text-xs text-navy/50">WhatsApp : {whatsapp}</p>
          )}
          <p className="mt-3 text-[10px] text-navy/30">
            Parfums inspirés des grandes maisons · Prix juste · JAMAAL
          </p>
        </footer>
      </div>
    </div>
  );
}
