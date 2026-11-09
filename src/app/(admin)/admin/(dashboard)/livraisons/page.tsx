import Link from "next/link";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getBusinessModel } from "@/lib/business-model-store";
import { DELIVERY_LABELS, haversineKm, isValidPoint, type DeliveryStatus } from "@/lib/delivery";
import { formatPrice } from "@/lib/currency";
import { payoutProvidersConfig } from "@/lib/payouts/providers";
import { DeliveryMap, type MapPoint } from "@/components/maps/DeliveryMap";
import { AssignLivreurForm, DeliveryAdminActions, type LivreurChoice } from "@/components/admin/AssignLivreurForm";
import { ListSearch } from "@/components/ListSearch";
import { LIVREUR_ACTIVE } from "@/lib/livreur-signup";
import { PayLivreursButton } from "@/components/admin/PayLivreursButton";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { DispatchModePanel } from "@/components/admin/DispatchModePanel";

export const dynamic = "force-dynamic";

const ACTIVE: DeliveryStatus[] = ["A_PREPARER", "ASSIGNEE", "RECUPEREE", "EN_ROUTE", "ECHEC"];

/** Position partagée depuis moins de 30 minutes ? */
function fresh(d: Date | null) {
  return !!d && Date.now() - d.getTime() < 30 * 60_000;
}

function ago(d: Date | null) {
  if (!d) return "jamais";
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  return min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : `il y a ${Math.round(min / 60)} h`;
}

export default async function LivraisonsPage() {
  await requireAdminPage("livraison");
  const [model, orders, livreurs, toPay, deliveredToday, others, history] = await Promise.all([
    getBusinessModel(),
    prisma.order.findMany({
      where: { deliveryMode: "LIVRAISON_JAMAAL", status: { not: "ANNULEE" }, deliveryStatus: { in: ACTIVE } },
      orderBy: { createdAt: "asc" },
      include: { livreur: { select: { name: true } } },
    }),
    prisma.livreur.findMany({ where: { active: true, status: LIVREUR_ACTIVE }, orderBy: { name: "asc" }, include: { _count: { select: { documents: true, orders: { where: { deliveryStatus: { in: ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"] } } } } } } }),
    prisma.livreurEarning.aggregate({ where: { status: "A_VERSER" }, _sum: { amount: true }, _count: true }),
    prisma.order.count({ where: { deliveryStatus: "LIVREE", deliveredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    // Toutes les autres commandes ouvertes (retrait, livrée par le consultant, sans étape de livraison) : assignables aussi.
    prisma.order.findMany({
      where: { status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] }, OR: [{ deliveryMode: { not: "LIVRAISON_JAMAAL" } }, { deliveryStatus: null }] },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: { id: true, customerName: true, customerPhone: true, address: true, deliveryPlace: true, deliveryLat: true, deliveryLng: true, deliveryMode: true, total: true, paymentStatus: true, createdAt: true, consultant: { select: { name: true } }, livreur: { select: { name: true } } },
    }),
    prisma.deliveryEvent.findMany({
      where: { status: "ASSIGNEE" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, createdAt: true, note: true, orderId: true, order: { select: { customerName: true } }, livreur: { select: { name: true, phone: true } } },
    }),
  ]);
  // Message WhatsApp envoyé au livreur pour chaque attribution (dans les 3 minutes qui suivent).
  const last9 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-9);
  const waLogs = history.length
    ? await prisma.whatsAppMessage.findMany({
        where: { direction: "OUT", kind: "livreur", createdAt: { gte: new Date(history[history.length - 1].createdAt.getTime() - 60_000) } },
        select: { toNumber: true, status: true, error: true, createdAt: true },
      })
    : [];
  const waFor = (phone: string | null | undefined, at: Date) =>
    waLogs.find((w) => last9(w.toNumber) === last9(phone) && w.createdAt.getTime() >= at.getTime() - 5_000 && w.createdAt.getTime() <= at.getTime() + 180_000);

  const toAssign = orders.filter((o) => o.deliveryStatus === "A_PREPARER" || o.deliveryStatus === "ECHEC");
  const inProgress = orders.filter((o) => !toAssign.includes(o));

  // Livreur suggéré : le plus proche de la destination (position récente), sinon le moins chargé.
  function suggest(dest: { lat: number; lng: number } | null) {
    if (!livreurs.length) return null;
    const located = livreurs.filter((l) => l.lastLat != null && l.lastLng != null && fresh(l.lastSeenAt));
    if (dest && located.length) {
      return located.reduce((best, l) => (haversineKm({ lat: l.lastLat!, lng: l.lastLng! }, dest) < haversineKm({ lat: best.lastLat!, lng: best.lastLng! }, dest) ? l : best)).id;
    }
    return livreurs.reduce((best, l) => (l._count.orders < best._count.orders ? l : best)).id;
  }

  const points: MapPoint[] = [{ id: "depot", kind: "depot", lat: model.depotLat, lng: model.depotLng, label: model.depotLabel }];
  for (const o of orders) {
    const p = { lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN };
    if (isValidPoint(p)) points.push({ id: o.id, kind: "destination", ...p, label: `${o.customerName} · ${DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]}` });
  }
  for (const l of livreurs) {
    if (l.lastLat != null && l.lastLng != null && fresh(l.lastSeenAt)) points.push({ id: `l-${l.id}`, kind: "livreur", lat: l.lastLat, lng: l.lastLng, label: `${l.name} · ${ago(l.lastSeenAt)}` });
  }
  const choices = (dest: { lat: number; lng: number } | null): LivreurChoice[] =>
    livreurs.map((l) => {
      const pos = l.lastLat != null && l.lastLng != null ? { lat: l.lastLat, lng: l.lastLng } : null;
      return { id: l.id, name: l.name, phone: l.phone, load: l._count.orders, live: fresh(l.lastSeenAt), km: pos && dest ? Math.round(haversineKm(pos, dest) * 10) / 10 : null, ready: l._count.documents > 0 };
    });
  const destOf = (o: { deliveryLat: number | null; deliveryLng: number | null }) => (isValidPoint({ lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN }) ? { lat: o.deliveryLat!, lng: o.deliveryLng! } : null);
  const MODE_LABEL: Record<string, string> = { RETRAIT_CONSULTANT: "retrait / consultant", LIVRAISON_JAMAAL: "livraison JAMAAL" };
  const WA_LABEL: Record<string, [string, string]> = {
    ENVOYE: ["WhatsApp envoyé", "text-emerald-800"], LIVRE: ["WhatsApp reçu", "text-emerald-800"], LU: ["WhatsApp lu", "text-emerald-800"],
    SIMULE: ["WhatsApp non configuré (simulé)", "text-amber-800"], ECHEC: ["WhatsApp refusé", "text-red-700"],
  };
  const anyPayout = payoutProvidersConfig().WAVE || payoutProvidersConfig().ORANGE_MONEY;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><Truck size={20} /></div>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">Livraisons</h1>
            <p className="text-sm text-navy/75">Départ : {model.depotLabel}. <Link href="/admin/modele-economique" className="font-semibold text-rose-dark hover:underline">Dépôt et tarifs</Link></p>
          </div>
        </div>
        <LiveRefresh seconds={20} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["À attribuer", toAssign.length],
          ["En cours", inProgress.length],
          ["Livrées aujourd'hui", deliveredToday],
          ["Livreurs en ligne", livreurs.filter((l) => fresh(l.lastSeenAt)).length + " / " + livreurs.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-white px-4 py-3">
            <p className="text-sm text-navy/80">{label}</p>
            <p className="text-2xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6"><DeliveryMap points={points} height={380} /></div>
      <p className="mt-2 text-sm text-navy/75">J = dépôt · repères rosés = adresses de livraison · 🛵 = livreurs ayant partagé leur position depuis moins de 30 min.</p>

      <DispatchModePanel mode={model.deliveryDispatch} maxActive={model.dispatchMaxActive} waiting={toAssign.filter((o) => o.deliveryStatus === "A_PREPARER" && !o.livreurId).length} />

      <div className="mt-6">
        <ListSearch target="livraisons-lists" total={orders.length + others.length} placeholder="Chercher une commande : client, téléphone, adresse, livreur, n°…" />
      </div>

      <div id="livraisons-lists">
      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">À attribuer ({toAssign.length})</h2>
        {toAssign.length === 0 ? <p className="mt-2 text-[15px] text-navy/80">Toutes les livraisons ont un livreur.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {toAssign.map((o) => {
              const dest = isValidPoint({ lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN }) ? { lat: o.deliveryLat!, lng: o.deliveryLng! } : null;
              return (
                <li key={o.id} data-search={`${o.customerName} ${o.customerPhone ?? ""} ${o.address ?? ""} ${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/commandes/${o.id}`} className="text-[15px] font-semibold text-ink hover:underline">{o.customerName}</Link>
                    {o.deliveryTarget === "VENDEUR" && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">chez {o.deliveryContactName ?? "le consultant"}</span>}
                    {o.deliveryApprox && <span title={o.deliveryPlace ?? undefined} className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">position approximative</span>}
                    <p className="text-sm text-navy/80">{o.address ?? "Adresse non renseignée"}{o.deliveryDistanceKm != null ? ` · ${o.deliveryDistanceKm} km` : ""} · {o.paymentStatus === "PAYE" ? "payée" : "à encaisser"}{o.deliveryStatus === "ECHEC" ? " · échec précédent" : ""}</p>
                  </div>
                  {livreurs.length ? <AssignLivreurForm orderId={o.id} livreurs={choices(dest)} suggestedId={suggest(dest)} /> : <Link href="/admin/livreurs/nouveau" className="text-sm font-semibold text-rose-dark">Ajouter un livreur</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">En cours ({inProgress.length})</h2>
        {inProgress.length === 0 ? <p className="mt-2 text-[15px] text-navy/80">Aucune tournée en cours.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {inProgress.map((o) => (
              <li key={o.id} data-search={`${o.customerName} ${o.customerPhone ?? ""} ${o.address ?? ""} ${o.livreur?.name ?? ""} ${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/admin/commandes/${o.id}`} className="text-[15px] font-semibold text-ink hover:underline">{o.customerName}</Link>
                    {o.deliveryTarget === "VENDEUR" && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">chez {o.deliveryContactName ?? "le consultant"}</span>}
                    {o.deliveryApprox && <span title={o.deliveryPlace ?? undefined} className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">position approximative</span>}
                  <p className="text-sm text-navy/80">{o.livreur?.name ?? "—"} · {DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]} · mis à jour {ago(o.updatedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {o.deliveryStatus === "ASSIGNEE" && livreurs.length > 0 && <AssignLivreurForm orderId={o.id} livreurs={choices(destOf(o))} suggestedId={o.livreurId} label="Réattribuer / relancer" reassign />}
                  <DeliveryAdminActions orderId={o.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Autres commandes en cours ({others.length})</h2>
        <p className="mt-1 text-sm text-navy/75">Retraits, commandes livrées par le consultant ou sans étape de livraison : « Assigner » les confie à un livreur JAMAAL (il est prévenu, le client reçoit le suivi).</p>
        {others.length === 0 ? <p className="mt-2 text-[15px] text-navy/80">Aucune.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {others.map((o) => (
              <li key={o.id} data-search={`${o.customerName} ${o.customerPhone ?? ""} ${o.address ?? ""} ${o.consultant?.name ?? ""} ${o.livreur?.name ?? ""} ${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/commandes/${o.id}`} className="text-[15px] font-semibold text-ink hover:underline">{o.customerName}</Link>
                  <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-navy/80">{MODE_LABEL[o.deliveryMode] ?? o.deliveryMode}</span>
                  <p className="text-sm text-navy/80">
                    n° {o.id.slice(-8).toUpperCase()} · {formatPrice(o.total)} · {o.paymentStatus === "PAYE" ? "payée" : "à encaisser"}
                    {o.consultant ? ` · ${o.consultant.name}` : ""} · {o.deliveryPlace ?? o.address ?? "adresse à préciser"}
                    {o.livreur ? ` · livreur noté : ${o.livreur.name} (non prévenu)` : ""}
                  </p>
                </div>
                {livreurs.length ? <AssignLivreurForm orderId={o.id} livreurs={choices(destOf(o))} suggestedId={suggest(destOf(o))} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p data-search-empty hidden className="mt-6 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-navy/65">Aucune commande ne correspond à cette recherche.</p>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Historique des attributions</h2>
        <p className="mt-1 text-sm text-navy/75">Chaque attribution, et ce que le livreur a reçu : notification dans l&apos;application JAMAAL Livreur (toujours) et message WhatsApp.</p>
        {history.length === 0 ? <p className="mt-2 text-[15px] text-navy/80">Aucune attribution pour le moment.</p> : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {history.map((h) => {
              const wa = waFor(h.livreur?.phone, h.createdAt);
              const [waText, waClass] = wa ? WA_LABEL[wa.status] ?? [wa.status, "text-navy/70"] : ["WhatsApp : aucun message", "text-navy/60"];
              return (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span>
                    <span className="text-navy/60">{h.createdAt.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>{" "}
                    <Link href={`/admin/commandes/${h.orderId}`} className="font-semibold text-ink hover:underline">{h.order?.customerName ?? h.orderId.slice(-8)}</Link> → <strong>{h.livreur?.name ?? "?"}</strong>
                    {h.note ? <span className="text-navy/60"> · {h.note}</span> : null}
                  </span>
                  <span className={`text-xs font-semibold ${waClass}`} title={wa?.error ?? undefined}>📱 Appli ✓ · {waText}{wa?.status === "ECHEC" && wa.error ? ` (${wa.error.slice(0, 60)})` : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-navy/60">WhatsApp refusé : Meta n&apos;accepte un message hors conversation récente qu&apos;avec un modèle validé (voir Journal WhatsApp). L&apos;application, elle, prévient toujours le livreur.</p>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Paiement des livreurs</h2>
        <p className="mt-1 text-[15px] text-navy/85">
          Part du livreur : {model.livreurSharePct} % des frais de livraison, versée sur son wallet à chaque livraison confirmée.
          En attente : <strong>{formatPrice(toPay._sum.amount ?? 0)}</strong> ({toPay._count} livraison(s)).
        </p>
        <div className="mt-3"><PayLivreursButton disabled={!anyPayout || !toPay._count} /></div>
        {!anyPayout && <p className="mt-2 text-sm text-amber-900">Versements non configurés (voir Admin &gt; Versements) : les parts s&apos;accumulent en attente.</p>}
      </section>
    </div>
  );
}
