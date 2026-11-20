import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { GroupDealJoinForm } from "@/components/GroupDealJoinForm";

export default async function GroupDealPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.groupDeal.findUnique({ where: { id }, include: { product: { select: { name: true, photo: true, volumes: true, regularPrice: true } }, _count: { select: { participants: true } } } });
  if (!deal) notFound();
  const volume = ((deal.product.volumes as { label?: string; price?: number }[] | null) ?? []).find((v) => v.label === deal.volumeLabel);
  const price = volume?.price ?? deal.product.regularPrice ?? 0;
  const expired = deal.expiresAt <= new Date() || deal.status === "EXPIREE";
  const closed = deal.status !== "OPEN" || expired;
  return <main className="mx-auto max-w-2xl px-4 py-8 sm:py-14"><article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
    {deal.product.photo && <Image src={deal.product.photo} alt={deal.product.name} width={960} height={640} unoptimized className="h-64 w-full object-cover" />}
    <div className="space-y-5 p-5 sm:p-8"><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Achat groupé Jamaal</p><h1 className="text-3xl font-bold">{deal.title}</h1>{deal.description && <p className="text-slate-600">{deal.description}</p>}
      <div className="rounded-2xl bg-slate-50 p-4"><h2 className="font-semibold">{deal.product.name} · {deal.volumeLabel}</h2><p className="mt-1 text-2xl font-bold">{formatPrice(price)} <span className="text-base font-medium text-slate-500">par article</span></p><p className="mt-1 text-sm text-slate-700">Remise de {deal.discountPct}% débloquée dès {deal.targetCount} participants</p></div>
      {deal.status === "ATTEINT" ? <div className="space-y-3"><div className="rounded-xl bg-emerald-50 p-4 text-sm">L’objectif est atteint. Les participants peuvent récupérer leur code de remise avec le même numéro de téléphone.</div><GroupDealJoinForm dealId={deal.id} title={deal.title} initialCount={deal._count.participants} targetCount={deal.targetCount} discountPct={deal.discountPct} /></div> : closed ? <div className="rounded-xl bg-slate-100 p-4 text-sm">Cette offre a expiré ou est terminée.</div> : <GroupDealJoinForm dealId={deal.id} title={deal.title} initialCount={deal._count.participants} targetCount={deal.targetCount} discountPct={deal.discountPct} />}
      <p className="text-xs text-slate-500">Fin de l’offre : {new Date(deal.expiresAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Dakar" })}. Les participants commanderont et paieront individuellement après déblocage de la remise.</p>
    </div></article></main>;
}
