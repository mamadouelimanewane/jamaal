import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { quickMarkPaid } from "@/lib/actions/order-quick";
import { paymentStage, statusChangeError } from "@/lib/orders/payment-rules";
import { paymentLine } from "@/lib/special-terms";
import { isInstallmentOrder } from "@/lib/installments";
import { InstallmentSchedule } from "@/components/InstallmentSchedule";
import { occasionOf } from "@/lib/gift/gift";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { updateOrderStatus, assignOrderLogistics } from "@/lib/actions/orders";
import { OrderStatus } from "@prisma/client";
import { CopyTrackingLink } from "@/components/admin/CopyTrackingLink";
import { OrderSplit } from "@/components/admin/OrderSplit";
import { OrderDeliveryPanel } from "@/components/admin/OrderDeliveryPanel";
import { OrderLocationField } from "@/components/admin/OrderLocationField";
import { ReservationActions } from "@/components/admin/ReservationActions";
import { RESERVATION_LABELS, type ReservationStatus } from "@/lib/reservation";

const statuses: OrderStatus[] = ["NON_PAYEE", "EN_ATTENTE", "CONFIRMEE", "EXPEDIEE", "LIVREE", "ANNULEE"];
const statusLabels: Record<string, string> = {
  NON_PAYEE: "Non payée",
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ statut?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const statutError = sp.statut?.slice(0, 300) ?? null;
  const statutOk = sp.ok?.slice(0, 200) ?? null;
  const [order, consultants, livreurs] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!order) notFound();

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const trackingUrl = `${protocol}://${host}/suivi/${order.id}`;

  // Paiement reçu hors paiement en ligne (Wave ou Orange Money sur le numéro de la boutique, espèces…) :
  // possible sauf paiement en plusieurs fois et réservation (réglés par leur échéancier / acompte).
  const canMarkPaid = order.paymentStatus !== "PAYE" && order.status !== "ANNULEE" && order.status !== "LIVREE" && order.installmentCount < 2 && !order.isReservation;

  async function changeStatus(formData: FormData) {
    "use server";
    const target = formData.get("status") as OrderStatus;
    let error: string | null = null;
    let ok: string | null = null;
    try {
      const o = await prisma.order.findUnique({ where: { id }, select: { status: true, paymentStatus: true, installmentCount: true, isReservation: true } });
      const payable = !!o && o.paymentStatus !== "PAYE" && o.status !== "ANNULEE" && o.status !== "LIVREE" && o.installmentCount < 2 && !o.isReservation;
      if (target === "CONFIRMEE" && payable && (o.status === "NON_PAYEE" || o.status === "EN_ATTENTE")) {
        // « Confirmée » choisie sur une commande non payée : c'est le paiement total qui arrive.
        const res = await quickMarkPaid(id);
        if (res.ok) ok = "Paiement enregistré : commande « Confirmée » (stock et commissions à jour).";
        else error = res.error ?? "Paiement non enregistré.";
      } else {
        const res = await updateOrderStatus(id, target);
        if (res.ok) ok = `Statut enregistré : « ${statusLabels[target] ?? target} ».`;
        else error = res.error;
      }
    } catch (e) {
      unstable_rethrow(e);
      console.error("[commande] changement de statut", id, target, e);
      error = `Le statut n'a pas pu être enregistré (${e instanceof Error ? e.message.slice(0, 160) : "erreur inconnue"}). Réessayez ; si cela continue, envoyez ce message à l'équipe technique.`;
    }
    redirect(`/admin/commandes/${id}?${error ? `statut=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok ?? "")}`}#statut`);
  }

  const wasPending = order.status === "NON_PAYEE" || order.status === "EN_ATTENTE";
  async function markPaid() {
    "use server";
    let error: string | null = null;
    try {
      const res = await quickMarkPaid(id);
      if (!res.ok) error = res.error ?? "Paiement non enregistré.";
    } catch (e) {
      unstable_rethrow(e);
      console.error("[commande] paiement reçu", id, e);
      error = `Le paiement n'a pas pu être enregistré (${e instanceof Error ? e.message.slice(0, 160) : "erreur inconnue"}).`;
    }
    const done = wasPending ? "Paiement enregistré : commande « Confirmée » (stock et commissions à jour)." : "Paiement enregistré (stock et commissions à jour).";
    redirect(`/admin/commandes/${id}?${error ? `statut=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(done)}`}#statut`);
  }

  // Statuts avant expédition : ils suivent le paiement. « Confirmée » reste possible sur une commande
  // non payée : la choisir enregistre le paiement total.
  const payStage = paymentStage(order);
  const confirmByPaying = canMarkPaid && (order.status === "NON_PAYEE" || order.status === "EN_ATTENTE");
  const allowed = (s: OrderStatus) => !statusChangeError(order, s) || (s === "CONFIRMEE" && confirmByPaying);

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Commande de {order.customerName}
          </h1>
          <p className="mt-1 text-sm text-navy/75">
            Passée le {order.createdAt.toLocaleDateString("fr-FR")} à{" "}
            {order.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <a
          href={`/admin/commandes/${order.id}/facture?print=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          📄 Facture (PDF)
        </a>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Coordonnées client</h2>
        <p className="text-sm text-navy/85">Téléphone : {order.customerPhone ?? "—"}</p>
        <p className="text-sm text-navy/85">E-mail : {order.customerEmail ?? "—"}</p>
        <p className="text-sm text-navy/85">Adresse : {order.address ?? "—"}</p>
        {order.customerPhone && (
          <a
            href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
          >
            Contacter sur WhatsApp →
          </a>
        )}
        <div className="mt-3">
          <CopyTrackingLink url={trackingUrl} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Articles</h2>
        <ul className="flex flex-col gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-navy/90">
                {item.productName} — {item.volumeLabel} × {item.quantity}
              </span>
              <span className="font-medium text-navy">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-semibold text-navy">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
        <p className="mt-2 text-right text-xs text-navy/75">Paiement : {paymentLine(order)}</p>
        {isInstallmentOrder(order) && <InstallmentSchedule order={order} className="mt-3" />}
      </div>

      {order.giftWrap && <div className="mt-4 rounded-xl border border-rose/30 bg-rose/5 p-4"><p className="text-sm font-semibold text-navy">Préparation cadeau</p>{order.giftOccasion && <p className="mt-1 text-sm text-navy/85">Occasion : {occasionOf(order.giftOccasion)?.label ?? order.giftOccasion}</p>}{order.giftFrom && <p className="mt-1 text-sm text-navy/85">De la part de : {order.giftFrom}</p>}{order.giftMessage && <p className="mt-1 text-sm text-navy/85">Message : {order.giftMessage}</p>}{order.giftVoiceUrl && <div className="mt-2"><p className="text-xs text-navy/70">Message vocal (à faire écouter ou transmettre au destinataire) :</p><audio src={order.giftVoiceUrl} controls className="mt-1 w-full max-w-sm" /></div>}</div>}
      {order.subscriptionId && <p className="mt-4 rounded-xl bg-ia-light px-4 py-2 text-sm text-ia-dark">Commande d&apos;un abonnement de réassort. <Link href="/admin/abonnements" className="font-semibold underline">Voir les abonnements</Link></p>}

      {canMarkPaid && (
        <form action={markPaid} className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900">Le client a payé {formatPrice(order.total)} ?</p>
            <p className="mt-0.5 text-xs text-emerald-900/80">
              Wave ou Orange Money sur le numéro de la boutique, espèces… Vérifiez que l&apos;argent est bien arrivé, puis enregistrez-le :
              la commande passe « Confirmée », les articles sortent du stock et les commissions sont créditées.
            </p>
          </div>
          <button className="w-full rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-fit">
            Paiement reçu · confirmer
          </button>
        </form>
      )}

      <form id="statut" action={changeStatus} className="mt-6 flex scroll-mt-24 flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-5">
        <label className="text-sm font-medium text-navy/85">Statut</label>
        <select name="status" defaultValue={order.status} className="rounded-lg border border-line px-3 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s} value={s} disabled={!allowed(s)}>
              {statusLabels[s]}
              {s === "CONFIRMEE" && confirmByPaying ? " (paiement total reçu)" : ""}
              {!allowed(s) ? (s === "CONFIRMEE" ? " (paiement total requis)" : s === "EN_ATTENTE" ? (payStage === "TOTAL" ? " (déjà payée)" : " (acompte requis)") : " (paiement déjà reçu)") : ""}
            </option>
          ))}
        </select>
        <button className="w-full rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light sm:ml-auto sm:w-fit">
          Mettre à jour
        </button>
        <p className="w-full text-xs text-navy/65">
          Le statut suit le paiement : rien encaissé = « Non payée », acompte ou paiement partiel = « En attente », payée en totalité = « Confirmée ».
          {payStage === "AUCUN" ? " Rien n'est encaissé pour l'instant." : payStage === "PARTIEL" ? " Un acompte ou une partie est encaissé." : " Payée en totalité."}
        </p>
        {statutError && <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{statutError}</p>}
        {statutOk && !statutError && <p role="status" className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{statutOk}</p>}
      </form>

      {order.isReservation && (
        <div className="mt-6 rounded-2xl border border-[#e3c9bf] bg-[#fbf4f1] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Réservation · {RESERVATION_LABELS[(order.reservationStatus ?? "ACOMPTE_ATTENDU") as ReservationStatus]}</h2>
              <p className="mt-1 text-sm text-navy/80">
                Acompte {formatPrice(order.depositAmount)} {order.depositPaidAt ? `payé le ${order.depositPaidAt.toLocaleDateString("fr-FR")}` : "non payé"} · solde {formatPrice(Math.max(0, order.total - order.depositAmount))}
                {order.reservationDelay ? ` · délai annoncé ${order.reservationDelay}` : ""}
              </p>
            </div>
            <ReservationActions orderId={order.id} status={order.reservationStatus ?? "ACOMPTE_ATTENDU"} canServe />
          </div>
          <p className="mt-2 text-xs text-navy/70">Vue d&apos;ensemble et quantités à commander : <a href="/admin/reservations" className="font-semibold text-rose-dark hover:underline">Réservations</a>.</p>
        </div>
      )}
      <OrderDeliveryPanel orderId={order.id} />
      <OrderSplit orderId={order.id} />

      {/* Historique horodaté des statuts */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Historique horodaté des statuts</h2>
        {order.statusHistory.length === 0 ? (
          <p className="text-xs text-navy/70">Aucun historique d&apos;étape enregistré pour l&apos;instant.</p>
        ) : (
          <div className="relative border-l-2 border-line pl-4 space-y-3">
            {order.statusHistory.map((h) => (
              <div key={h.id} className="relative text-xs">
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-navy" />
                <span className="font-semibold text-navy">
                  {statusLabels[h.status] ?? h.status}
                </span>
                <span className="ml-2 text-navy/70">
                  {h.createdAt.toLocaleDateString("fr-FR")} à {h.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form action={assignOrderLogistics.bind(null, id)} className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Logistique & consultant</h2>
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-medium text-navy/85">Consultant à l&apos;origine de la vente</label>
            <select
              name="consultantId"
              defaultValue={order.consultantId ?? ""}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">— Aucun —</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-navy/85">Mode de livraison</label>
            <select
              name="deliveryMode"
              defaultValue={order.deliveryMode}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="RETRAIT_CONSULTANT">Retrait / livraison par le consultant</option>
              <option value="LIVRAISON_JAMAAL">Livraison directe par JAMAAL (le consultant sera notifié)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-navy/85">Livreur assigné <span className="font-normal text-navy/60">(choisir un livreur passe la commande en livraison JAMAAL : il est prévenu dans son application et sur WhatsApp)</span></label>
            <select
              name="livreurId"
              defaultValue={order.livreurId ?? ""}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">— Aucun —</option>
              {livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <OrderLocationField lat={order.deliveryLat} lng={order.deliveryLng} productsTotal={order.total - order.deliveryFee} currentFee={order.deliveryFee} paid={order.paymentStatus === "PAYE"} customerPhone={order.deliveryContactPhone ?? order.customerPhone} />

          {order.deliveryLat && order.deliveryLng && (
            <a
              href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-navy hover:underline"
            >
              Voir l&apos;adresse sur la carte →
            </a>
          )}

          <button className="mt-1 w-fit rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            Enregistrer la logistique
          </button>
        </div>
      </form>
    </div>
  );
}
