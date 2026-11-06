import { getT } from "@/lib/i18n/server";
import Link from "@/components/i18n/Link";
import { isInstallmentOrder, nextInstallment } from "@/lib/installments";
import { InstallmentSchedule } from "@/components/InstallmentSchedule";
import { PAY_LINK_REF } from "@/lib/pay-link";
import { prisma } from "@/lib/prisma";
import { SubscribeOffer } from "@/components/subscription/SubscribeOffer";
import { subscriptionDiscountPct } from "@/lib/subscriptions/run";
import { occasionOf } from "@/lib/gift/gift";
import { notFound } from "next/navigation";
import { getOrderConfirmation } from "@/lib/actions/orders";
import { formatPrice } from "@/lib/currency";
import { ReorderButton } from "@/components/ReorderButton";
import { PayOrderButton } from "@/components/PayOrderButton";
import { PaymentWatcher } from "@/components/PaymentWatcher";
import { settlePendingPayment } from "@/lib/payment/settle";
import { amountDue, RESERVATION_LABELS, type ReservationStatus } from "@/lib/reservation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string }>;
};

const paymentMethodLabels: Record<string, string> = {
  A_LA_LIVRAISON: "À la livraison",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  WALLET: "Wallet JAMAAL",
  STRIPE: "Carte bancaire",
};

const paymentStatusLabels: Record<string, string> = {
  EN_ATTENTE: "Paiement en attente",
  PAYE: "Payé",
  ECHOUE: "Échec du paiement",
};

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const t = await getT();
  const { id } = await params;
  const sp = await searchParams;
  let order = await getOrderConfirmation(id);
  if (!order) notFound();
  // Paiement en attente : on le vérifie auprès du prestataire (Versus ou Wave), même si le webhook n'est pas arrivé,
  // puis on relit la commande. Un paiement ou un acompte payé n'est ainsi jamais oublié.
  if (order.paymentStatus === "EN_ATTENTE" && amountDue(order)) {
    const result = await settlePendingPayment(id);
    if (result === "paid") order = (await getOrderConfirmation(id)) ?? order;
  }

  const paymentStatus = (order as { paymentStatus?: string }).paymentStatus ?? "NONE";
  const paymentMethod = (order as { paymentMethod?: string }).paymentMethod ?? "COD";
  // Le statut vient de la base (vérifié auprès du prestataire) : l'adresse « ?paid=1 » seule ne prouve rien.
  const isPaid = paymentStatus === "PAYE";
  const isCanceled = sp.canceled === "1" && !isPaid;
  // Lien de paiement envoyé par le conseiller, pas encore ouvert : rien n'est « en cours » chez le prestataire.
  const linkNotStarted = order.channel === "REVENDEUR" && order.paymentRef === PAY_LINK_REF && !isPaid;
  // Paiement en plusieurs fois : entre deux échéances, rien n'est « en cours » (la dernière a été comptée).
  const inst = isInstallmentOrder(order) && !isPaid ? nextInstallment(order) : null;
  const betweenInstallments = !!inst && order.installmentsPaid >= 1 && !!order.paymentRef && order.installmentRefs.includes(order.paymentRef);
  const isPending = paymentStatus === "EN_ATTENTE" && !isPaid && !linkNotStarted && !betweenInstallments;
  const due = amountDue(order);
  const resa = order.isReservation ? ((order.reservationStatus ?? "ACOMPTE_ATTENDU") as ReservationStatus) : null;
  const balance = Math.max(0, order.total - order.depositAmount);
  const [subPct, existingSub] = await Promise.all([
    subscriptionDiscountPct(),
    prisma.subscription.findFirst({ where: { sourceOrderId: order.id, status: { not: "ANNULE" } }, select: { token: true } }).catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <PaymentWatcher active={isPending && !!due} />
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-dark">
          {resa ? t("Réservation · {v0}", { v0: RESERVATION_LABELS[resa] }) : isPaid
            ? t("Paiement confirmé")
            : inst && order.installmentsPaid > 0 && !isPending
              ? t("{installmentsPaid}/{installmentCount} échéances réglées", { installmentsPaid: order.installmentsPaid, installmentCount: order.installmentCount })
            : linkNotStarted
              ? t("Commande à régler")
            : isCanceled
              ? t("Paiement annulé")
              : isPending
                ? t("Paiement en attente")
                : t("Commande enregistrée")}
        </p>
        <h1 className="mt-3 font-serif-display text-2xl font-semibold text-navy">
          {t("Merci,")} {order.customerName} !
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-navy/70">
          {resa ? (
            resa === "ACOMPTE_ATTENDU"
              ? t("Votre réservation est enregistrée. Réglez l'acompte de {v0} pour la confirmer ; nous commandons alors votre produit (délai annoncé : {v1}).", { v0: formatPrice(order.depositAmount), v1: order.reservationDelay ?? "quelques semaines" })
              : resa === "RESERVEE"
                ? t("Acompte reçu, merci ! Votre produit est commandé (délai annoncé : {v0}). Nous vous prévenons sur WhatsApp dès son arrivée.", { v0: order.reservationDelay ?? "quelques semaines" })
                : resa === "DISPONIBLE"
                  ? t("Votre produit est arrivé ! Reste à régler : {v0}, en ligne ci-dessous ou {v1}.", { v0: formatPrice(balance), v1: order.deliveryMode === "LIVRAISON_JAMAAL" ? "à la livraison" : "au retrait" })
                  : resa === "SOLDEE"
                    ? t("Réservation soldée : votre commande suit son cours.")
                    : t("Cette réservation a été annulée.")
          ) : isPaid
            ? t("Votre paiement a bien été reçu. Nous préparons votre commande.")
            : inst && order.installmentsPaid > 0 && !isPending
              ? t("Merci, votre échéance est bien reçue. Prochaine échéance : {v0} le {v1}, avec un rappel sur WhatsApp. Votre commande est préparée dès qu'elle est entièrement réglée.", { v0: formatPrice(inst.amount), v1: inst.dueAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }) })
            : linkNotStarted
              ? t("{v0} a préparé votre commande. Réglez-la en ligne avec le bouton ci-dessous : elle est préparée dès réception du paiement.", { v0: order.consultant?.name ?? "Votre conseiller JAMAAL" })
            : isCanceled
              ? t("Le paiement a été annulé. Votre commande reste enregistrée : réglez-la avec le bouton ci-dessous, ou contactez-nous sur WhatsApp.")
              : isPending
                ? t("Si vous avez finalisé le paiement, la confirmation peut prendre quelques instants. Cette page se mettra à jour.")
                : t("Votre commande a bien été enregistrée. Notre équipe ou votre consultant vous contactera très vite pour confirmer la livraison et le règlement.")}
        </p>

        {resa ? (
          due && due.amount > 0 && <PayOrderButton orderId={order.id} label={due.part === "ACOMPTE" ? t("Payer l'acompte ({v0})", { v0: formatPrice(due.amount) }) : t("Payer le solde ({v0})", { v0: formatPrice(due.amount) })} />
        ) : (
          !isPaid && <PayOrderButton orderId={order.id} label={inst ? t("Payer l'échéance {n}/{of} ({v2})", { n: inst.n, of: inst.of, v2: formatPrice(inst.amount) }) : undefined} />
        )}
        {isInstallmentOrder(order) && <InstallmentSchedule order={order} className="mt-6" />}

        <div className="mt-6 rounded-xl bg-navy/5 px-4 py-3 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-navy/60">{t("N° de commande")}</span>
            <span className="font-mono text-xs font-semibold text-navy">
              {order.id.slice(-8).toUpperCase()}
            </span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-navy/60">{t("Total")}</span>
            <span className="font-semibold text-navy">{formatPrice(order.total)}</span>
          </div>
          {resa && (
            <>
              <div className="mt-2 flex justify-between">
                <span className="text-navy/60">{t("Acompte")}</span>
                <span className="font-semibold text-navy">{formatPrice(order.depositAmount)} · {order.depositPaidAt ? <span className="text-emerald-700">{t("payé")}</span> : <span className="text-amber-700">{t("à payer")}</span>}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-navy/60">{t("Solde à l'arrivée")}</span>
                <span className="font-semibold text-navy">{formatPrice(balance)}</span>
              </div>
            </>
          )}
          {!resa && <div className="mt-2 flex justify-between">
            <span className="text-navy/60">{t("Paiement")}</span>
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
                  ? t("Payé")
                  : paymentStatusLabels[paymentStatus] ?? paymentStatus}
              </span>
            </span>
          </div>}
          {order.consultant && (
            <div className="mt-2 flex justify-between">
              <span className="text-navy/60">{t("Consultant·e")}</span>
              <span className="font-semibold text-navy">
                {order.consultant.name} ({order.consultant.city})
              </span>
            </div>
          )}
        </div>

        {order.giftWrap && <div className="mt-4 rounded-xl border border-rose/30 bg-rose/5 p-4 text-left text-sm"><p className="font-semibold text-navy">{t("Commande cadeau")}</p>{order.giftFrom && <p className="mt-1 text-navy/70">{t("De la part de")} {order.giftFrom}{order.giftOccasion ? ` · ${occasionOf(order.giftOccasion)?.label ?? ""}` : ""}</p>}{order.giftMessage && <p className="mt-1 text-navy/70">« {order.giftMessage} »</p>}{order.giftVoiceUrl && <audio src={order.giftVoiceUrl} controls className="mt-2 w-full" />}</div>}

        {!order.isReservation && order.customerPhone && order.status !== "ANNULEE" && !order.subscriptionId && <SubscribeOffer orderId={order.id} discountPct={subPct} existingToken={existingSub?.token ?? null} />}

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
            {t("Suivre ma commande →")}
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
              {t("Contacter mon consultant sur WhatsApp")}
            </a>
          )}

          <Link href="/" className="text-sm font-semibold text-rose-dark">
            {t("Retour à l'accueil")}
          </Link>
        </div>
      </div>
    </div>
  );
}
