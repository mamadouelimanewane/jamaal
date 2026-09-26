"use client";

import { useState } from "react";
import { Minus, Plus, ShieldCheck } from "lucide-react";
import { Product } from "@/data/types";
import { useCartStore } from "@/lib/cart-store";

function formatPrice(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function ProductPurchasePanel({ product }: { product: Product }) {
  const volumes = product.volumes ?? [
    { label: "Format unique", price: product.regularPrice ?? 0 },
  ];
  const [volumeIdx, setVolumeIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const volume = volumes[volumeIdx];

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        volumeLabel: volume.label,
        price: volume.price,
        colorFrom: product.colorFrom,
        colorTo: product.colorTo,
      },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-2xl font-semibold text-navy">{formatPrice(volume.price)}</p>
        <p className="text-xs text-navy/50">Taxes incluses.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/70">Volume</p>
        <div className="flex flex-wrap gap-2">
          {volumes.map((v, i) => (
            <button
              key={v.label}
              onClick={() => setVolumeIdx(i)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                i === volumeIdx
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-white text-navy hover:border-rose"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/70">Quantité</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="rounded-full border border-line p-2"
          >
            <Minus size={14} />
          </button>
          <span className="w-6 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="rounded-full border border-line p-2"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <button
        onClick={handleAdd}
        className="w-full rounded-full bg-navy py-4 text-sm font-semibold text-white transition hover:bg-navy-light"
      >
        {added ? "Ajouté au panier ✓" : "Ajouter au panier"}
      </button>

      <div className="flex items-center gap-2 text-xs text-navy/60">
        <ShieldCheck size={16} className="text-rose-dark" />
        Paiement sécurisé
      </div>
    </div>
  );
}
