import Link from "next/link";
import { notFound } from "next/navigation";
import { Repeat } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { intervalLabel, parseSubDelivery, parseSubItems } from "@/lib/subscriptions/plan";
import { SubscriptionManager } from "@/components/subscription/SubscriptionManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon réassort JAMAAL", robots: { index: false } };

const STATUS: Record<string, string> = { ACTIVE: "Actif", PAUSE: "En pause", ANNULE: "Arrêté" };

/** Gestion de l'abonnement par le client (lien secret reçu sur WhatsApp, sans compte). */
export default async function AbonnementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await prisma.subscription.findUnique({ where: { token: token.slice(0, 60) } });
  if (!sub) notFound();
  const items = parseSubItems(sub.items);
  const delivery = parseSubDelivery(sub.delivery);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="luxury-eyebrow flex items-center gap-2"><Repeat size={14} /> Réassort automatique</p>
      <h1 className="mt-2 font-serif-display text-3xl text-navy">Bonjour {sub.customerName.split(" ")[0]}</h1>
      <div className="mt-6 rounded-3xl border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-navy/70">Statut</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sub.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-cream text-navy"}`}>{STATUS[sub.status] ?? sub.status}</span>
        </div>
        <ul className="mt-4 space-y-1 text-sm text-navy">
          {items.map((i) => <li key={`${i.productId}-${i.volumeLabel}`}>• {i.productName}{i.volumeLabel && i.volumeLabel !== "Unique" ? ` (${i.volumeLabel})` : ""} × {i.quantity}</li>)}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-navy/60">Fréquence</dt><dd className="font-semibold text-navy">{intervalLabel(sub.intervalDays)}</dd></div>
          <div><dt className="text-navy/60">Remise abonné</dt><dd className="font-semibold text-navy">{sub.discountPct} %</dd></div>
          <div><dt className="text-navy/60">Prochaine commande</dt><dd className="font-semibold text-navy">{sub.status === "ACTIVE" ? sub.nextRunAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "—"}</dd></div>
          <div><dt className="text-navy/60">Remise</dt><dd className="font-semibold text-navy">{delivery.mode === "LIVRAISON" ? `Livraison${delivery.place ? ` · ${delivery.place}` : ""}` : "Chez votre revendeur"}</dd></div>
        </dl>
        {sub.lastOrderId && <Link href={`/commande/${sub.lastOrderId}`} className="mt-4 inline-block text-sm font-semibold text-navy underline">Voir la dernière commande</Link>}
      </div>
      <div className="mt-6 rounded-3xl border border-line bg-white p-6">
        <SubscriptionManager token={sub.token} status={sub.status} intervalDays={sub.intervalDays} />
      </div>
      <p className="mt-4 text-xs text-navy/60">Les prix suivent le catalogue du jour. Nous vous écrivons sur WhatsApp 3 jours avant chaque commande.</p>
    </div>
  );
}
