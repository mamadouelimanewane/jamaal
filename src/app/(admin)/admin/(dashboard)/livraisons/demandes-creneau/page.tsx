import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { DeliveryRequestActions } from "@/components/admin/AdminOperationsActions";

export const dynamic = "force-dynamic";

export default async function DeliveryRequestsPage() {
  await requireAdminPage("livraison");
  const events = await prisma.deliveryEvent.findMany({
    where: { status: "DEMANDE_REPROGRAMMATION" },
    orderBy: { createdAt: "asc" },
    include: { order: { select: { id: true, customerName: true, customerPhone: true, address: true, deliveryStatus: true } } },
  });
  return <main className="max-w-5xl space-y-5"><header><p className="text-xs font-semibold uppercase tracking-widest text-ia">Opérations · livraison</p><h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Demandes de changement de créneau</h1><p className="mt-1 text-sm text-navy/70">Confirmez ou refusez les propositions envoyées par les clients. Votre décision sera visible dans leur suivi de commande.</p></header><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">À traiter</p><p className="text-2xl font-semibold">{events.length}</p></div><Link href="/admin/livraisons" className="flex items-center rounded-xl border bg-white p-4 text-sm font-medium underline">Ouvrir le tableau des livraisons</Link><Link href="/admin/commandes" className="flex items-center rounded-xl border bg-white p-4 text-sm font-medium underline">Rechercher une commande</Link></div>{events.length ? <div className="grid gap-3">{events.map((event)=><article key={event.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{event.order.customerName} · commande {event.order.id.slice(-8).toUpperCase()}</h2><p className="text-sm text-slate-600">{event.order.customerPhone} · {event.order.address ?? "Adresse non renseignée"}</p><p className="mt-1 text-xs text-slate-500">Reçue le {new Date(event.createdAt).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Dakar"})}</p></div><span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">À traiter</span></div><div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">{event.note}</div><DeliveryRequestActions eventId={event.id}/></article>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-slate-600">Aucune demande en attente. Les nouvelles demandes client apparaîtront ici.</p>}</main>;
}
