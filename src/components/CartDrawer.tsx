"use client";

import Link from "next/link";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";

export function CartDrawer() {
  const { items, isOpen, close, removeItem, updateQuantity, total } = useCartStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fermer le panier"
        onClick={close}
        className="absolute inset-0 bg-navy/40"
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Votre panier</h2>
          <button onClick={close} aria-label="Fermer">
            <X size={20} className="text-navy" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-navy/60">Votre panier est vide.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.productId + item.volumeLabel} className="flex gap-3 border-b border-line pb-4">
                  <div
                    className="h-16 w-16 shrink-0 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${item.colorFrom}, ${item.colorTo})`,
                    }}
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-sm font-medium text-navy">{item.name}</p>
                    <p className="text-xs text-navy/60">{item.volumeLabel}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.volumeLabel, item.quantity - 1)}
                        className="rounded border border-line p-1"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.volumeLabel, item.quantity + 1)}
                        className="rounded border border-line p-1"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => removeItem(item.productId, item.volumeLabel)}
                        className="ml-auto text-rose-dark"
                        aria-label="Retirer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-navy">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-navy">
            <span>Total</span>
            <span>{formatPrice(total())}</span>
          </div>
          <Link
            href="/panier"
            onClick={close}
            className="block w-full rounded-full bg-navy py-3 text-center text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Voir le panier
          </Link>
        </div>
      </div>
    </div>
  );
}
