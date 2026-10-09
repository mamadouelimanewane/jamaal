import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { arrivalMessage, RESERVATION_LABELS, type ReservationStatus } from "@/lib/reservation";
import { getSiteUrl } from "@/lib/site-url";
import { getReservationSettings } from "@/lib/reservation-store";
import { ReservationActions, ReservationSettingsForm } from "@/components/admin/ReservationActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réservations" };

const OPEN = ["ACOMPTE_ATTENDU", "RESERVEE", "DISPONIBLE"];
const BADGE: Record<string, string> = {
  ACOMPTE_ATTENDU: "bg-amber-50 text-amber-900",
  RESERVEE: "bg-sky-50 text-sky-900",
  DISPONIBLE: "bg-emerald-50 text-emerald-900",
  SOLDEE: "bg-navy/5 text-navy/80",
  ANNULEE: "bg-red-50 text-red-800",
};

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

export default async function ReservationsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const month = daysAgo(30);
  const [settings, base, orders] = await Promise.all([
    getReservationSettings(),
    getSiteUrl(),
    prisma.order.findMany({
      where: { isReservation: true, OR: [{ reservationStatus: { in: OPEN } }, { updatedAt: { gte: month } }] },
      orderBy: { createdAt: "asc" },
      include: { items: { include: { variant: { select: { stock: true, code: true } }, product: { select: { stock: true, choganCode: true, number: true } } } } },
    }),
  ]);

  // Regroupement par produit et format : quantités réservées, stock actuel, à commander chez Chogan.
  type Group = { key: string; name: string; format: string; code: string | null; stock: number; waiting: number; paid: number; orders: typeof orders };
  const groups = new Map<string, Group>();
  for (const o of orders.filter((x) => x.reservationStatus === "ACOMPTE_ATTENDU" || x.reservationStatus === "RESERVEE")) {
    const it = o.items[0];
    if (!it) continue;
    const key = `${it.productId}:${it.variantId ?? it.volumeLabel}`;
    const g = groups.get(key) ?? {
      key,
      name: it.productName,
      format: it.volumeLabel,
      code: it.variant?.code ?? it.product?.choganCode ?? null,
      stock: it.variant?.stock ?? it.product?.stock ?? 0,
      waiting: 0,
      paid: 0,
      orders: [],
    };
    g.waiting += it.quantity;
    if (o.reservationStatus === "RESERVEE") g.paid += it.quantity;
    g.orders.push(o);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.paid - a.paid || b.waiting - a.waiting);
  const ready = orders.filter((o) => o.reservationStatus === "DISPONIBLE");
  const closed = orders.filter((o) => o.reservationStatus === "SOLDEE" || o.reservationStatus === "ANNULEE").reverse();
  const deposits = orders.filter((o) => o.depositPaidAt && OPEN.includes(o.reservationStatus ?? "")).reduce((s, o) => s + o.depositAmount, 0);

  const row = (o: (typeof orders)[number], canServe: boolean) => {
    const it = o.items[0];
    const st = (o.reservationStatus ?? "ACOMPTE_ATTENDU") as ReservationStatus;
    return (
      <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <Link href={`/admin/commandes/${o.id}`} className="text-[15px] font-semibold text-ink hover:underline">{o.customerName}</Link>
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[st]}`}>{RESERVATION_LABELS[st]}</span>
          <p className="text-sm text-navy/80">
            {it ? `${it.productName} · ${it.volumeLabel} × ${it.quantity}` : "—"} · total {formatPrice(o.total)} · acompte {formatPrice(o.depositAmount)}
            {o.depositPaidAt ? " (payé)" : ""}
          </p>
          <p className="text-xs text-navy/65">
            {o.customerPhone ?? "sans téléphone"} · réservée le {o.createdAt.toLocaleDateString("fr-FR")}
            {o.reservationDelay ? ` · délai annoncé ${o.reservationDelay}` : ""}
            {o.deliveryMode === "LIVRAISON_JAMAAL" ? " · livraison" : " · retrait"}
          </p>
        </div>
        <ReservationActions
          orderId={o.id}
          status={st}
          canServe={canServe}
          notifyUrl={st === "DISPONIBLE" ? arrivalMessage({ id: o.id, customerName: o.customerName, customerPhone: o.customerPhone ?? o.deliveryContactPhone, total: o.total, depositAmount: o.depositAmount, deliveryMode: o.deliveryMode, product: it ? `${it.productName} (${it.volumeLabel})` : "produit" }, base, formatPrice).url : null}
        />
      </li>
    );
  };

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Réservations</h1>
      <p className="mt-1 text-sm text-navy/75">
        Produits en rupture réservés par les clients avec un acompte. Commandez chez Chogan les quantités indiquées ; à la réception,
        cliquez « Produit arrivé » : le stock est attribué au client, la commande passe en préparation et le client est prévenu pour le solde.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">En attente</p><p className="text-xl font-semibold text-ink">{list.reduce((s, g) => s + g.orders.length, 0)}</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Acomptes encaissés</p><p className="text-xl font-semibold text-ink">{formatPrice(deposits)}</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Arrivées, solde à régler</p><p className="text-xl font-semibold text-ink">{ready.length}</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">À commander chez Chogan</p><p className="text-xl font-semibold text-ink">{list.reduce((s, g) => s + Math.max(0, g.paid - g.stock), 0)} unité(s)</p></div>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Par produit</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-[15px] text-navy/80">Aucune réservation en attente.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {list.map((g) => {
              let left = g.stock;
              return (
                <div key={g.key} className="rounded-xl border border-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-cream/60 px-4 py-2.5">
                    <p className="font-semibold text-ink">{g.name} <span className="font-normal text-navy/75">· {g.format}{g.code ? ` · ${g.code}` : ""}</span></p>
                    <p className="text-sm text-navy/85">
                      Réservé : <strong>{g.waiting}</strong> (dont {g.paid} avec acompte) · En stock : <strong>{g.stock}</strong> ·{" "}
                      <span className={g.paid > g.stock ? "font-semibold text-rose-dark" : "text-emerald-800"}>{g.paid > g.stock ? `à commander : ${g.paid - g.stock}` : "stock suffisant"}</span>
                    </p>
                  </div>
                  <ul className="divide-y divide-line px-4">
                    {g.orders.map((o) => {
                      const q = o.items[0]?.quantity ?? 0;
                      const can = o.reservationStatus === "RESERVEE" && left >= q;
                      if (can) left -= q;
                      return row(o, can);
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {ready.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Arrivées, solde à régler ({ready.length})</h2>
          <ul className="mt-2 divide-y divide-line">{ready.map((o) => row(o, false))}</ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Réglages</h2>
        <div className="mt-3"><ReservationSettingsForm settings={settings} /></div>
      </section>

      {closed.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Terminées (30 derniers jours)</h2>
          <ul className="mt-2 divide-y divide-line">{closed.map((o) => row(o, false))}</ul>
        </section>
      )}
    </div>
  );
}
