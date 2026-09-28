"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/currency";
import { createOrder } from "@/lib/actions/orders";
import { getActiveConsultantsForCheckout } from "@/lib/actions/public-data";
import { initiatePayment } from "@/lib/actions/payment";
import { listPaymentOptions } from "@/lib/actions/payment-options";
import {
  PaymentMethodSelector,
  type PaymentOption,
} from "@/components/PaymentMethodSelector";
import type { PaymentProviderId } from "@/lib/payment/types";

const REF_COOKIE = "jamaal_ref";

function readRefCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, total, clear } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [consultantId, setConsultantId] = useState("");
  const [acceptCgv, setAcceptCgv] = useState(false);
  const [consultants, setConsultants] = useState<
    { id: string; name: string; city: string; slug?: string | null }[]
  >([]);
  const [refLocked, setRefLocked] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([
    {
      id: "cod",
      label: "Paiement à la livraison",
      description: "Réglez en espèces ou mobile money à la livraison.",
    },
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentProviderId>("cod");

  useEffect(() => {
    getActiveConsultantsForCheckout().then((list) => {
      setConsultants(list);

      const refSlug = readRefCookie();
      if (refSlug) {
        const match = list.find(
          (c) => (c as { slug?: string }).slug?.toLowerCase() === refSlug.toLowerCase()
        );
        if (match) {
          setConsultantId(match.id);
          setRefLocked(true);
        }
      }
    });
    listPaymentOptions().then((opts) => {
      if (opts.length) {
        setPaymentOptions(opts);
        setPaymentMethod(opts[0].id);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer.name || !customer.phone) {
      setError("Merci de renseigner au moins votre nom et votre téléphone.");
      return;
    }
    if (!acceptCgv) {
      setError("Vous devez accepter les Conditions Générales de Vente.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const id = await createOrder(
        {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
        },
        items.map((i) => ({
          productId: i.productId,
          productName: i.name,
          volumeLabel: i.volumeLabel,
          price: i.price,
          quantity: i.quantity,
        })),
        consultantId || null,
        acceptCgv
      );
      clear();

      const pay = await initiatePayment(id, paymentMethod);
      if (pay.redirect && pay.url) {
        window.location.href = pay.url;
        return;
      }
      router.push(`/commande/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue, merci de réessayer.");
    } finally {
      setSubmitting(false);
    }
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
                  style={{
                    background: `linear-gradient(135deg, ${item.colorFrom}, ${item.colorTo})`,
                  }}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/produits/${item.slug}`} className="text-sm font-semibold text-navy">
                    {item.name}
                  </Link>
                  <p className="text-xs text-navy/60">{item.volumeLabel}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.volumeLabel, item.quantity - 1)
                      }
                      className="rounded border border-line p-1"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.volumeLabel, item.quantity + 1)
                      }
                      className="rounded border border-line p-1"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId, item.volumeLabel)}
                      className="ml-auto flex items-center gap-1 text-xs text-rose-dark"
                    >
                      <Trash2 size={13} /> Retirer
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-navy">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-line bg-white p-5">
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

              {consultants.length > 0 && (
                <div>
                  <select
                    value={consultantId}
                    onChange={(e) => setConsultantId(e.target.value)}
                    disabled={refLocked}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy disabled:bg-navy/5"
                  >
                    <option value="">Consultant·e qui vous a recommandé JAMAAL (optionnel)</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.city})
                      </option>
                    ))}
                  </select>
                  {refLocked && (
                    <p className="mt-1 text-xs text-navy/50">
                      Commande rattachée automatiquement à votre consultant.
                    </p>
                  )}
                </div>
              )}

              <PaymentMethodSelector
                options={paymentOptions}
                value={paymentMethod}
                onChange={setPaymentMethod}
              />

              <label className="flex items-start gap-2 text-xs text-navy/70">
                <input
                  type="checkbox"
                  checked={acceptCgv}
                  onChange={(e) => setAcceptCgv(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  J&apos;accepte les{" "}
                  <Link href="/cgv" className="font-semibold text-rose-dark underline">
                    Conditions Générales de Vente
                  </Link>
                </span>
              </label>
            </div>

            {error && <p className="mt-3 text-xs text-rose-dark">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
            >
              {submitting
                ? "Envoi…"
                : paymentMethod === "cod"
                  ? "Passer la commande"
                  : "Payer et commander"}
            </button>

            <p className="mt-3 text-center text-[11px] text-navy/40">
              {paymentMethod === "cod"
                ? "Règlement à la livraison ou via votre consultant."
                : "Vous serez redirigé vers la page de paiement sécurisée."}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
