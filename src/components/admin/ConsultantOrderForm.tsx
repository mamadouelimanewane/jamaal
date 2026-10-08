"use client";

import { useState, useTransition } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { searchProductsForOrder, type ProductSearchResult } from "@/lib/actions/product-search";
import { createConsultantOrder } from "@/lib/actions/consultant-orders";
import { formatPrice } from "@/lib/currency";

interface LineItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

export function ConsultantOrderForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [isPending, startTransition] = useTransition();

  function search(value: string) {
    setQuery(value);
    startTransition(async () => {
      const r = await searchProductsForOrder(value);
      setResults(r);
    });
  }

  function addItem(product: ProductSearchResult, volumeLabel: string, price: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.volumeLabel === volumeLabel);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: product.id, productName: product.name, volumeLabel, price, quantity: 1 }];
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <form action={createConsultantOrder} className="mt-6 grid gap-6 lg:grid-cols-2">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">1. Ajouter des produits</h2>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/65" />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Rechercher un produit JAMAAL…"
            className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
          />
        </div>

        <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {isPending && <p className="text-xs text-navy/65">Recherche…</p>}
          {results.map((p) => {
            const volumes = p.volumes?.length ? p.volumes : [{ label: "Format unique", price: p.regularPrice ?? 0 }];
            return (
              <div key={p.id} className="rounded-xl border border-line p-3">
                <p className="text-sm font-medium text-navy">{p.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {volumes.map((v) => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => addItem(p, v.label, v.price)}
                      className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-navy hover:bg-cream"
                    >
                      <Plus size={12} />
                      {v.label} — {formatPrice(v.price)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-navy/70">
          Articles sélectionnés
        </h3>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm">
              <span>
                {item.productName} — {item.volumeLabel} × {item.quantity}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-navy">{formatPrice(item.price * item.quantity)}</span>
                <button type="button" onClick={() => removeItem(i)} className="text-rose-dark">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && <p className="text-xs text-navy/65">Aucun article ajouté.</p>}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold text-navy">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">2. Informations client</h2>
        <div className="grid gap-3">
          <div>
            <label className={labelClass}>Nom du client</label>
            <input name="customerName" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Téléphone (WhatsApp)</label>
            <input name="customerPhone" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Adresse de livraison</label>
            <textarea name="address" rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Mode de livraison</label>
            <select name="deliveryMode" defaultValue="RETRAIT_CONSULTANT" className={inputClass}>
              <option value="RETRAIT_CONSULTANT">Je livre / remets moi-même le colis</option>
              <option value="LIVRAISON_JAMAAL">JAMAAL livre directement mon client (je serai notifié)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={items.length === 0}
            className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-50"
          >
            Enregistrer la commande
          </button>
        </div>
      </div>
    </form>
  );
}
