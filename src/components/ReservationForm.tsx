"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import { createReservation } from "@/lib/actions/orders";
import { initiatePayment } from "@/lib/actions/payment";
import { listPaymentOptions } from "@/lib/actions/payment-options";
import { getActiveConsultantsForCheckout } from "@/lib/actions/public-data";
import { DeliveryChooser, type DeliveryChoice } from "@/components/DeliveryChooser";
import { PaymentMethodSelector, type PaymentOption } from "@/components/PaymentMethodSelector";
import type { PaymentProviderId } from "@/lib/payment/types";
import { depositFor, type ReservationSettings } from "@/lib/reservation";

const field = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";

function readRefCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )jamaal_ref=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function ReservationForm({
  product,
  formats,
  initialFormat,
  initialQty,
  settings,
}: {
  product: { id: string; slug: string; name: string; photo: string | null };
  formats: { label: string; price: number }[];
  initialFormat: string;
  initialQty: number;
  settings: ReservationSettings;
}) {
  const router = useRouter();
  const [format, setFormat] = useState(initialFormat);
  const [qty, setQty] = useState(initialQty);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [delivery, setDelivery] = useState<DeliveryChoice>({ mode: "RETRAIT" });
  const [consultants, setConsultants] = useState<{ id: string; name: string; city: string; slug?: string | null }[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [refLocked, setRefLocked] = useState(false);
  const [options, setOptions] = useState<PaymentOption[] | null>(null);
  const [method, setMethod] = useState<PaymentProviderId | null>(null);
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getActiveConsultantsForCheckout()
      .then((list) => {
        setConsultants(list);
        const ref = readRefCookie();
        const match = ref ? list.find((c) => c.slug?.toLowerCase() === ref.toLowerCase()) : null;
        if (match) {
          setConsultantId(match.id);
          setRefLocked(true);
        }
      })
      .catch(() => {});
    listPaymentOptions()
      .then((opts) => {
        const online = opts.filter((o) => o.id !== "cod");
        setOptions(online);
        if (online.length) setMethod(online[0].id);
      })
      .catch(() => setOptions([]));
  }, []);

  const unit = formats.find((f) => f.label === format)?.price ?? formats[0].price;
  const productsTotal = unit * qty;
  const deposit = depositFor(productsTotal, settings.depositPercent);
  const fee = delivery.mode === "LIVRAISON" && delivery.quote?.ok ? delivery.quote.fee : 0;
  const balance = productsTotal + fee - deposit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accept) return setError("Acceptez les conditions de réservation et les CGV.");
    if (delivery.mode === "LIVRAISON") {
      if (delivery.lat == null || delivery.lng == null) return setError("Indiquez la position de livraison, ou choisissez le retrait.");
      if (delivery.quote && !delivery.quote.ok) return setError(delivery.quote.error);
      if (!customer.address.trim()) return setError("Précisez votre adresse de livraison (quartier, repère).");
    }
    setSubmitting(true);
    try {
      const res = await createReservation(
        customer,
        { productId: product.id, productName: product.name, volumeLabel: format, price: unit, quantity: qty },
        consultantId || null,
        accept,
        delivery.mode === "LIVRAISON"
          ? { mode: "LIVRAISON", lat: delivery.lat, lng: delivery.lng, approx: delivery.approx === true, place: delivery.place ?? null }
          : { mode: "RETRAIT" }
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (method) {
        try {
          const pay = await initiatePayment(res.id, method);
          if (!pay.error && pay.redirect && pay.url) {
            window.location.href = pay.url;
            return;
          }
        } catch {
          // la réservation est enregistrée : l'acompte pourra être payé depuis la page de suivi
        }
      }
      router.push(`/commande/${res.id}`);
    } catch {
      setError("Une erreur est survenue, merci de réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div className="flex gap-4 rounded-2xl border border-line bg-white p-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cream">
            {product.photo && <Image src={product.photo} alt="" fill sizes="96px" className="object-contain p-1.5" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-navy">{product.name}</p>
            <p className="mt-1 text-sm text-navy/70">Actuellement en rupture · disponible sous <strong>{settings.delayLabel}</strong></p>
            {formats.length > 1 ? (
              <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format" className={`mt-2 max-w-xs ${field}`}>
                {formats.map((f) => <option key={f.label} value={f.label}>{f.label} — {formatPrice(f.price)}</option>)}
              </select>
            ) : (
              <p className="mt-2 text-sm text-navy">{format} — {formatPrice(unit)}</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-navy/70">Quantité</span>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Réduire la quantité" className="flex h-8 w-8 items-center justify-center border border-line"><Minus size={13} /></button>
              <span aria-live="polite" className="w-5 text-center text-sm">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Augmenter la quantité" className="flex h-8 w-8 items-center justify-center border border-line"><Plus size={13} /></button>
            </div>
          </div>
        </div>

        <fieldset className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-navy">Vos coordonnées</legend>
          <input required placeholder="Nom complet" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} className={field} />
          <input required placeholder="Téléphone (WhatsApp)" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} className={field} />
          <input type="email" placeholder="E-mail (optionnel)" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} className={`${field} sm:col-span-2`} />
          <textarea rows={2} placeholder={delivery.mode === "LIVRAISON" ? "Adresse de livraison (quartier, rue, repère)" : "Adresse (facultatif)"} value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} className={`${field} sm:col-span-2`} />
          {consultants.length > 0 && (
            <select value={consultantId} onChange={(e) => setConsultantId(e.target.value)} disabled={refLocked} className={`${field} sm:col-span-2 disabled:bg-navy/5`}>
              <option value="">Consultant·e qui vous a recommandé JAMAAL (optionnel)</option>
              {consultants.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
            </select>
          )}
        </fieldset>

        <div className="rounded-2xl border border-line bg-white p-4">
          <DeliveryChooser productsTotal={productsTotal} value={delivery} onChange={setDelivery} recipientPhone={customer.phone} />
          <p className="mt-2 text-xs text-navy/70">La livraison est faite à l&apos;arrivée du produit ; les frais s&apos;ajoutent au solde.</p>
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-24">
        <p className="flex items-center gap-2 font-semibold text-navy"><CalendarClock size={17} className="text-[#9c6254]" /> Votre réservation</p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-navy/70">Produits</dt><dd>{formatPrice(productsTotal)}</dd></div>
          {delivery.mode === "LIVRAISON" && <div className="flex justify-between"><dt className="text-navy/70">Livraison</dt><dd>{delivery.quote?.ok ? (delivery.quote.free ? "Offerte" : formatPrice(fee)) : "—"}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-navy"><dt>Acompte à payer maintenant ({settings.depositPercent} %)</dt><dd>{formatPrice(deposit)}</dd></div>
          <div className="flex justify-between text-navy/80"><dt>Solde à l&apos;arrivée</dt><dd>{formatPrice(balance)}</dd></div>
        </dl>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-navy/75">
          <li>Délai annoncé : {settings.delayLabel} après la réservation.</li>
          <li>Nous vous prévenons sur WhatsApp dès l&apos;arrivée ; vous réglez alors le solde en ligne, à la livraison ou au retrait.</li>
          <li>{settings.refundable ? "Acompte remboursé si vous annulez avant l'arrivée du produit." : "L'acompte n'est pas remboursable en cas d'annulation."}</li>
        </ul>
        {options && options.length > 0 && method ? (
          <PaymentMethodSelector options={options} value={method} onChange={setMethod} />
        ) : options ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">Le paiement en ligne n&apos;est pas encore ouvert : votre réservation est enregistrée et JAMAAL vous contacte pour l&apos;acompte (Wave ou Orange Money).</p>
        ) : null}
        <label className="flex items-start gap-2 text-xs text-navy/80">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5" />
          <span>J&apos;accepte les conditions de réservation ci-dessus et les <a href="/cgv" target="_blank" className="underline">Conditions Générales de Vente</a>.</span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button disabled={submitting} className="w-full rounded-full bg-[#9c6254] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7f4d42] disabled:opacity-60">
          {submitting ? "Enregistrement…" : options?.length ? `Réserver et payer ${formatPrice(deposit)}` : "Réserver"}
        </button>
      </aside>
    </form>
  );
}
