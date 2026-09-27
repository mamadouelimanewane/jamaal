"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";
import { createOrder } from "@/lib/actions/orders";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, clear } = useCartStore();
  const [ordered, setOrdered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer.name || !customer.phone) {
      setError("Merci de renseigner au moins votre nom et votre téléphone.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createOrder(
        { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address },
        items.map((i) => ({
          productId: i.productId,
          productName: i.name,
          volumeLabel: i.volumeLabel,
          price: i.price,
          quantity: i.quantity,
        }))
      );
      setOrdered(true);
      clear();
    } catch {
      setError("Une erreur est survenue, merci de réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ordered) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Merci pour votre commande !</h1>
        <p className="mt-3 text-sm text-navy/70">
          Votre commande a bien été enregistrée. Notre équipe vous contactera très vite au numéro
          indiqué pour confirmer la livraison et le règlement.
        </p>
        <Link
          href="/"
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

          <form
            onSubmit={handleSubmit}
            className="h-fit rounded-2xl border border-line bg-white p-5"
          >
            <div className="flex items-center justify-between text-sm text-navy/70">
              <span>Sous-total</span>
              <span>{formatPrice(total())}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-semibold text-navy">
              <span>Total</span>
              <span>{formatPrice(total())}</span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <input
                required
                placeholder="Nom complet"
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
              />
              <input
                required
                placeholder="Téléphone"
                value={customer.phone}
                onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
              />
              <input
                type="email"
                placeholder="E-mail (optionnel)"
                value={customer.email}
                onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
              />
              <textarea
                placeholder="Adresse de livraison"
                rows={2}
                value={customer.address}
                onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
              />
            </div>

            {error && <p className="mt-3 text-xs text-rose-dark">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
            >
              {submitting ? "Envoi…" : "Passer la commande"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
