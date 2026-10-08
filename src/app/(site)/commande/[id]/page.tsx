import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderConfirmation } from "@/lib/actions/orders";
import { formatPrice } from "@/lib/currency";
import { ReorderButton } from "@/components/ReorderButton";
import { PayOrderButton } from "@/components/PayOrderButton";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string }>;
};

const paymentMethodLabels: Record<string, string> = {
  A_LA_LIVRAISON: "À la livraison",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  STRIPE: "Carte bancaire",
};

const paymentStatusLabels: Record<string, string> = {
  EN_ATTENTE: "Paiement en attente",
  PAYE: "Payé",
  ECHOUE: "Échec du paiement",
};

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrderConfirmation(id);
  if (!order) notFound();

  const paymentStatus = (order as { paymentStatus?: string }).paymentStatus ?? "NONE";
  const paymentMethod = (order as { paymentMethod?: string }).paymentMethod ?? "COD";
  const isPaid = paymentStatus === "PAYE" || sp.paid === "1";
  const isCanceled = sp.canceled === "1" && !isPaid;
  const isPending = paymentStatus === "EN_ATTENTE" && !isPaid;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-dark">
          {isPaid
            ? "Paiement confirmé"
            : isCanceled
              ? "Paiement annulé"
              : isPending
                ? "Paiement en attente"
                : "Commande enregistrée"}
        </p>
        <h1 className="mt-3 font-serif-display text-2xl font-semibold text-navy">
          Merci, {order.customerName} !
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-navy/70">
          {isPaid
            ? "Votre paiement a bien été reçu. Nous préparons votre commande."
            : isCanceled
              ? "Le paiement a été annulé. Votre commande reste enregistrée : réglez-la avec le bouton ci-dessous, ou contactez-nous sur WhatsApp."
              : isPending
                ? "Si vous avez finalisé le paiement, la confirmation peut prendre quelques instants. Cette page se mettra à jour."
                : "Votre commande a bien été enregistrée. Notre équipe ou votre consultant vous contactera très vite pour confirmer la livraison et le règlement."}
        </p>

        {!isPaid && <PayOrderButton orderId={order.id} />}

        <div className="mt-6 rounded-xl bg-navy/5 px-4 py-3 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-navy/60">N° de commande</span>
            <span className="font-mono text-xs font-semibold text-navy">
              {order.id.slice(-8).toUpperCase()}
            </span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-navy/60">Total</span>
            <span className="font-semibold text-navy">{formatPrice(order.total)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-navy/60">Paiement</span>
            <span className="font-semibold text-navy">
              {paymentMethodLabels[paymentMethod] ?? paymentMethod}
              {" · "}
              <span
                className={
                  isPaid
                    ? "text-emerald-700"
                    : isPending
                      ? "text-amber-700"
                      : "text-navy/70"
                }
              >
                {isPaid
                  ? "Payé"
                  : paymentStatusLabels[paymentStatus] ?? paymentStatus}
              </span>
            </span>
          </div>
          {order.consultant && (
            <div className="mt-2 flex justify-between">
              <span className="text-navy/60">Consultant·e</span>
              <span className="font-semibold text-navy">
                {order.consultant.name} ({order.consultant.city})
              </span>
            </div>
          )}
        </div>

        {order.giftWrap && <div className="mt-4 rounded-xl border border-rose/30 bg-rose/5 p-4 text-left text-sm"><p className="font-semibold text-navy">Commande cadeau</p>{order.giftMessage && <p className="mt-1 text-navy/70">« {order.giftMessage} »</p>}</div>}

        <ul className="mt-6 space-y-2 text-left text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between border-b border-line/60 pb-2">
              <span className="text-navy/80">
                {item.productName}{" "}
                <span className="text-xs text-navy/50">
                  ({item.volumeLabel} × {item.quantity})
                </span>
              </span>
              <span className="font-medium text-navy">
                {formatPrice(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3">
          <ReorderButton orderId={order.id} />
          <Link
            href={`/suivi/${order.id}`}
            className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Suivre ma commande →
          </Link>

          {order.consultant?.whatsapp && (
            <a
              href={
                order.consultant.whatsapp.startsWith("http")
                  ? order.consultant.whatsapp
                  : `https://wa.me/${order.consultant.whatsapp.replace(/\D/g, "")}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-navy"
            >
              Contacter mon consultant sur WhatsApp
            </a>
          )}

          <Link href="/" className="text-sm font-semibold text-rose-dark">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
