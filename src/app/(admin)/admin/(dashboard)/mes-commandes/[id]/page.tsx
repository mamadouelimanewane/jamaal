import { notFound, redirect } from "next/navigation";
import { paymentLine } from "@/lib/special-terms";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { ReceiptDownload } from "@/components/admin/ReceiptDownload";
import { CopyTrackingLink } from "@/components/admin/CopyTrackingLink";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";
import { CopyButton } from "@/components/admin/CopyButton";
import { getSiteUrl } from "@/lib/site-url";
import { isPayLinkOrder, payLinkMessage, payLinkUrl } from "@/lib/pay-link";
import { isInstallmentOrder, planLabel } from "@/lib/installments";
import { InstallmentSchedule } from "@/components/InstallmentSchedule";
import { settlePendingPayment } from "@/lib/payment/settle";
import { shopWhatsAppLink } from "@/lib/shop/consultant-shop";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function MesCommandeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lien?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") redirect("/admin");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    include: { consultant: true },
  });
  if (!user?.consultant) notFound();

  let order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.consultantId !== user.consultant.id) notFound();
  // Lien de paiement : on vérifie le paiement auprès du prestataire à l'ouverture (même sans webhook).
  if (isPayLinkOrder(order) && order.paymentStatus === "EN_ATTENTE" && order.status !== "ANNULEE") {
    if ((await settlePendingPayment(id).catch(() => "unknown")) === "paid") order = (await prisma.order.findUnique({ where: { id }, include: { items: true } })) ?? order;
  }
  const justCreated = (await searchParams).lien === "1";
  const payLink = isPayLinkOrder(order) ? payLinkUrl((await getSiteUrl().catch(() => "")) || "https://www.jamaal.sn", order.id) : null;
  const payMsg = payLink ? payLinkMessage({ customerName: order.customerName, total: order.total, url: payLink, seller: user.consultant.name, ref: order.id.slice(-8).toUpperCase(), plan: isInstallmentOrder(order) ? planLabel(order.total, order.installmentCount) : null }) : "";
  const payWa = payLink && order.customerPhone ? shopWhatsAppLink(order.customerPhone, payMsg) : null;
  const linkPaid = payLink && order.paymentStatus === "PAYE";

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const trackingUrl = `${protocol}://${host}/suivi/${order.id}`;

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Commande de {order.customerName}
      </h1>
      <p className="mt-1 text-sm text-navy/75">
        {order.createdAt.toLocaleDateString("fr-FR")} — {statusLabels[order.status] ?? order.status}
      </p>

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
        {order.deliveryFee > 0 && (
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm text-navy/90">
            <span>Livraison{order.deliveryDistanceKm != null ? ` (${order.deliveryDistanceKm} km)` : ""}</span>
            <span>{formatPrice(order.deliveryFee)}</span>
          </div>
        )}
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-semibold text-navy">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
        <p className="mt-2 text-right text-xs text-navy/75">Paiement : {paymentLine(order)}</p>
        {isInstallmentOrder(order) && <InstallmentSchedule order={order} className="mt-3" />}
      </div>

      {payLink && order.status !== "ANNULEE" && (
        <div className={`mt-6 rounded-2xl border p-5 ${linkPaid ? "border-emerald-200 bg-emerald-50" : justCreated ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200" : "border-sky-200 bg-sky-50"}`}>
          {linkPaid ? (
            <>
              <h2 className="text-sm font-semibold text-emerald-950">Paiement reçu en ligne ✓</h2>
              <p className="mt-1 text-sm text-emerald-950/85">
                {order.customerName} a payé {formatPrice(order.total)}{order.paidAt ? ` le ${order.paidAt.toLocaleDateString("fr-FR")} à ${order.paidAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}. Vos commissions sont enregistrées{order.deliveryMode === "LIVRAISON_JAMAAL" ? " et la livraison est en préparation" : ""}.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-sky-950">{justCreated ? "Commande enregistrée : envoyez le lien de paiement" : isInstallmentOrder(order) && order.installmentsPaid > 0 ? `${order.installmentsPaid}/${order.installmentCount} échéances réglées` : "Lien de paiement en attente"}</h2>
              <p className="mt-1 text-sm text-sky-950/85">
                Votre client paie {formatPrice(order.total)} en ligne (Wave ou Orange Money){isInstallmentOrder(order) ? ` en ${order.installmentCount} fois (${planLabel(order.total, order.installmentCount)})` : ""} avec ce lien{isInstallmentOrder(order) ? ", qui sert aussi aux échéances suivantes" : ""}. Dès le paiement, la commande{order.deliveryMode === "LIVRAISON_JAMAAL" ? " part en livraison" : " est confirmée"}, vos commissions sont enregistrées et vous êtes prévenu·e.
              </p>
              <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-navy">{payLink}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {payWa && (
                  <a href={payWa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-[#128C4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F7A41]">
                    Envoyer sur le WhatsApp de {order.customerName.split(/\s+/)[0]}
                  </a>
                )}
                <CopyButton text={payMsg} label="Copier le message" />
                <CopyButton text={payLink} label="Copier le lien" />
              </div>
              <p className="mt-2 text-xs text-sky-950/70">Le paiement se vérifie tout seul ; rouvrez cette page pour voir l&apos;état à jour. Sans aucun paiement, votre client reçoit un rappel au bout de 2 jours et la commande est annulée au bout de 7 jours (produits remis en stock).</p>
            </>
          )}
        </div>
      )}

      {order.deliveryMode === "LIVRAISON_JAMAAL" && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-navy">Livraison JAMAAL</h2>
            {order.deliveryStatus ? (
              <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-ink">{DELIVERY_LABELS[order.deliveryStatus as DeliveryStatus] ?? order.deliveryStatus}</span>
            ) : payLink && !linkPaid ? (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-950">Part dès le paiement</span>
            ) : null}
          </div>
          <p className="mt-2 text-[15px] text-ink">
            {order.deliveryTarget === "VENDEUR" ? "Livrée chez vous, pour votre client." : "Livrée directement à votre client."}
          </p>
          <p className="text-sm text-navy/85">{order.address ?? "Adresse non renseignée"}</p>
          {order.deliveryCode && (
            <p className="mt-3 text-sm text-navy/90">
              Code de remise à donner au livreur{order.deliveryTarget === "VENDEUR" ? "" : " (transmis aussi au client)"} :{" "}
              <span className="rounded-lg bg-navy px-2.5 py-1 font-mono text-base font-semibold tracking-widest text-white">{order.deliveryCode}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-navy">Lien de suivi client</p>
          <p className="text-xs text-navy/70">
            Votre client peut suivre sa commande en direct, sans compte, avec ce lien.
          </p>
        </div>
        <CopyTrackingLink url={trackingUrl} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">
          Envoyer le récapitulatif à mon client
        </h2>
        <ReceiptDownload
          clientWhatsapp={order.customerPhone}
          trackingUrl={trackingUrl}
          data={{
            orderId: order.id.slice(-8).toUpperCase(),
            customerName: order.customerName,
            date: order.createdAt.toLocaleDateString("fr-FR"),
            items: order.items.map((i) => ({
              productName: i.productName,
              volumeLabel: i.volumeLabel,
              quantity: i.quantity,
              price: i.price,
            })),
            total: order.total,
            consultantName: user.consultant.name,
            consultantWhatsapp: user.consultant.whatsapp,
            deliveryMode: order.deliveryMode,
            status: order.status,
          }}
        />
      </div>
    </div>
  );
}
