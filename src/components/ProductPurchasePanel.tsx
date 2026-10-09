"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Minus, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import type { Product } from "@/data/types";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";
import { depositFor, type ReservationSettings } from "@/lib/reservation";

const LOW = 5;

export function ProductPurchasePanel({ product, reservation }: { product: Product; reservation?: ReservationSettings | null }) {
  const volumes = product.volumes ?? [{ label: "Format unique", price: product.regularPrice ?? 0 }];
  const stockOf = (label: string) => product.availability?.[label] ?? Infinity;
  // Format proposé d'office : le premier disponible.
  const firstAvailable = Math.max(0, volumes.findIndex((v) => stockOf(v.label) > 0));
  const [volumeIdx, setVolumeIdx] = useState(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const volume = volumes[volumeIdx];
  const stock = stockOf(volume.label);
  const out = stock <= 0;
  // Format en rupture : réservation possible (avec acompte) si elle est proposée.
  const reservable = out && !!reservation?.enabled;
  const maxQty = reservable ? 20 : Math.max(1, Math.min(20, Number.isFinite(stock) ? stock : 20));

  function choose(i: number) {
    setVolumeIdx(i);
    const st = stockOf(volumes[i].label);
    setQuantity((q) => Math.min(q, st <= 0 ? 20 : Math.max(1, Math.min(20, Number.isFinite(st) ? st : 20))));
  }

  function handleAdd() {
    if (out) return;
    addItem({ productId: product.id, slug: product.slug, name: product.name, volumeLabel: volume.label, price: volume.price, colorFrom: product.colorFrom, colorTo: product.colorTo }, Math.min(quantity, maxQty));
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  }

  return <div className="flex flex-col gap-6">
    <div>
      <p className="font-serif-display text-3xl font-medium text-[#14213b]">{formatPrice(volume.price)}</p>
      <p className="mt-1 text-[10px] text-navy/45">Prix du format sélectionné · FCFA</p>
      <p aria-live="polite" className={`mt-2 inline-flex items-center gap-2 text-xs font-semibold ${out ? "text-red-700" : stock <= LOW ? "text-amber-700" : "text-emerald-700"}`}>
        <span className={`h-2 w-2 rounded-full ${out ? "bg-red-600" : stock <= LOW ? "bg-amber-500" : "bg-emerald-600"}`} />
        {out ? "Rupture de stock pour ce format" : stock <= LOW ? `Plus que ${stock} en stock` : "En stock, expédié rapidement"}
      </p>
    </div>
    <fieldset><legend className="mb-3 text-[9px] font-semibold uppercase tracking-[0.17em] text-navy/60">Choisir un format</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{volumes.map((option, index) => {
      const s = stockOf(option.label);
      const selected = index === volumeIdx;
      return <button key={option.label} type="button" onClick={() => choose(index)} aria-pressed={selected} className={`relative flex min-h-[62px] flex-col items-center justify-center border px-3 py-2 text-center transition ${selected ? "border-[#1d2f4f] bg-[#1d2f4f] text-white" : s <= 0 ? "border-dashed border-[#e3d3cd] text-navy/45 hover:border-[#9c6254]" : "border-[#e3d3cd] bg-transparent text-navy hover:border-[#9c6254]"}`}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">{option.label}</span>
        <span className={`mt-1 text-[9px] ${selected ? "text-white/75" : "text-navy/50"}`}>{formatPrice(option.price)}</span>
        {s <= 0 && <span className={`mt-0.5 text-[8px] font-semibold uppercase tracking-wide ${selected ? "text-white/80" : "text-red-700/80"}`}>Rupture</span>}
      </button>;
    })}</div></fieldset>
    <div className="flex items-center justify-between border-y border-[#eadfda] py-4"><span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-navy/60">Quantité</span><div className="flex items-center gap-4"><button type="button" disabled={out && !reservable} onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Réduire la quantité" className="flex h-8 w-8 items-center justify-center border border-[#e3d3cd] text-navy transition hover:border-navy disabled:opacity-40"><Minus size={13}/></button><span aria-live="polite" className="min-w-4 text-center text-sm">{quantity}</span><button type="button" disabled={(out && !reservable) || quantity >= maxQty} onClick={() => setQuantity((current) => Math.min(maxQty, current + 1))} aria-label="Augmenter la quantité" className="flex h-8 w-8 items-center justify-center border border-[#e3d3cd] text-navy transition hover:border-navy disabled:opacity-40"><Plus size={13}/></button></div></div>
    {reservable && reservation ? <div className="space-y-3">
      <p className="flex items-start gap-2 bg-[#f6efe9] px-4 py-3 text-xs leading-5 text-navy/80"><CalendarClock size={16} className="mt-0.5 shrink-0 text-[#9c6254]"/><span>Réservez ce format : disponible sous <strong>{reservation.delayLabel}</strong>. Acompte de {reservation.depositPercent} % soit <strong>{formatPrice(depositFor(volume.price * quantity, reservation.depositPercent))}</strong>, le solde à l&apos;arrivée{reservation.refundable ? " ; acompte remboursé si vous annulez avant l'arrivée" : ""}.</span></p>
      <Link href={`/reserver/${product.slug}?format=${encodeURIComponent(volume.label)}&qte=${quantity}`} className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#9c6254] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#7f4d42]"><CalendarClock size={16}/>Réserver ce format</Link>
    </div> : <button type="button" onClick={handleAdd} disabled={out} className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#1d2f4f] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#14213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c6254] disabled:cursor-not-allowed disabled:bg-navy/35"><ShoppingBag size={16}/>{out ? "Format en rupture" : added ? "Ajouté à votre panier" : "Ajouter au panier"}</button>}
    <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.12em] text-navy/50"><ShieldCheck size={14} className="text-[#9c6254]"/>Paiement sécurisé · Livraison à votre convenance</div>
  </div>;
}
