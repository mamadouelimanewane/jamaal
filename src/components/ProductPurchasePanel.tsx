"use client";

import { useState } from "react";
import { Minus, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import type { Product } from "@/data/types";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";

export function ProductPurchasePanel({ product }: { product: Product }) {
  const volumes = product.volumes ?? [{ label: "Format unique", price: product.regularPrice ?? 0 }];
  const [volumeIdx, setVolumeIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const volume = volumes[volumeIdx];

  function handleAdd() {
    addItem({ productId: product.id, slug: product.slug, name: product.name, volumeLabel: volume.label, price: volume.price, colorFrom: product.colorFrom, colorTo: product.colorTo }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  }

  return <div className="flex flex-col gap-6">
    <div><p className="font-serif-display text-3xl font-medium text-[#241915]">{formatPrice(volume.price)}</p><p className="mt-1 text-[10px] text-navy/45">Prix du format sélectionné · FCFA</p></div>
    <fieldset><legend className="mb-3 text-[9px] font-semibold uppercase tracking-[0.17em] text-navy/60">Choisir un format</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{volumes.map((option, index) => <button key={option.label} type="button" onClick={() => setVolumeIdx(index)} aria-pressed={index === volumeIdx} className={`flex min-h-[62px] flex-col items-center justify-center border px-3 py-2 text-center transition ${index === volumeIdx ? "border-[#6a2632] bg-[#6a2632] text-white" : "border-[#ded4c9] bg-transparent text-navy hover:border-[#9a755d]"}`}><span className="text-[10px] font-semibold uppercase tracking-[0.1em]">{option.label}</span><span className={`mt-1 text-[9px] ${index === volumeIdx ? "text-white/75" : "text-navy/50"}`}>{formatPrice(option.price)}</span></button>)}</div></fieldset>
    <div className="flex items-center justify-between border-y border-[#e8e0d7] py-4"><span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-navy/60">Quantité</span><div className="flex items-center gap-4"><button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Réduire la quantité" className="flex h-8 w-8 items-center justify-center border border-[#ded4c9] text-navy transition hover:border-navy"><Minus size={13}/></button><span aria-live="polite" className="min-w-4 text-center text-sm">{quantity}</span><button type="button" onClick={() => setQuantity((current) => Math.min(20, current + 1))} aria-label="Augmenter la quantité" className="flex h-8 w-8 items-center justify-center border border-[#ded4c9] text-navy transition hover:border-navy"><Plus size={13}/></button></div></div>
    <button type="button" onClick={handleAdd} className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#6a2632] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#4f1c26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a755d]"><ShoppingBag size={16}/>{added ? "Ajouté à votre panier" : "Ajouter au panier"}</button>
    <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.12em] text-navy/50"><ShieldCheck size={14} className="text-[#9a755d]"/>Paiement sécurisé · Livraison à votre convenance</div>
  </div>;
}