"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, clear } = useCartStore();
  const [ordered, setOrdered] = useState(false);

  if (ordered) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Merci pour votre commande !</h1>
        <p className="mt-3 text-sm text-navy/70">
          Cette boutique de démonstration ne traite pas de paiement réel. Une fois votre
          intégration officielle JAMAAL / paiement en place, cette étape déclenchera votre vrai
          tunnel de commande.
        </p>
        <Link
          href="/"
          onClick={() => clear()}
          className="mt-6 inline-block rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Votre panier</h1>

      {items.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-navy/60">Votre panier est vide pour le moment.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-rose-dark">
            Continuer mes achats →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <ul className="flex flex-col gap-4 lg:col-span-2">
            {items.map((item) => (
              <li
                key={item.productId + item.volumeLabel}
                className="flex gap-4 rounded-2xl border border-line bg-white p-4"
              >
                <div
                  className="h-20 w-20 shrink-0 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${item.colorFrom}, ${item.colorTo})` }}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/produits/${item.slug}`} className="text-sm font-semibold text-navy">
                    {item.name}
                  </Link>
                  <p className="text-xs text-navy/60">{item.volumeLabel}</p>
                  <div className="mt-1 flex items-center gap-2">
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
                      className="ml-auto flex items-center gap-1 text-xs text-rose-dark"
                    >
                      <Trash2 size={13} /> Retirer
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-navy">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <div className="h-fit rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between text-sm text-navy/70">
              <span>Sous-total</span>
              <span>{formatPrice(total())}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-semibold text-navy">
              <span>Total</span>
              <span>{formatPrice(total())}</span>
            </div>
            <button
              onClick={() => setOrdered(true)}
              className="mt-5 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
            >
              Passer la commande
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
