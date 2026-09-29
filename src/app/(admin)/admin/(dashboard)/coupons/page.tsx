import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteCoupon } from "@/lib/actions/coupons";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { orders: true } } } });
  const now = new Date();
  const activeCount = coupons.filter((coupon) => coupon.active && (!coupon.expiresAt || coupon.expiresAt > now) && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit)).length;
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-dark">Acquisition & fidélité</p><h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Codes promotionnels</h1><p className="mt-1 text-sm text-navy/60">{activeCount} codes actifs · {coupons.length} au total</p></div><Link href="/admin/coupons/nouveau" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">+ Créer un code</Link></div>
    <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-sm"><thead className="bg-cream text-left text-xs uppercase text-navy/50"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Avantage</th><th className="px-4 py-3">Utilisations</th><th className="px-4 py-3">Expiration</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"></th></tr></thead><tbody>{coupons.map((coupon) => { const valid = coupon.active && (!coupon.expiresAt || coupon.expiresAt > now) && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit); return <tr key={coupon.id} className="border-t border-line"><td className="px-4 py-3 font-semibold tracking-wider text-navy">{coupon.code}</td><td className="px-4 py-3">{coupon.type === "POURCENTAGE" ? `${coupon.value}%` : formatPrice(coupon.value)}</td><td className="px-4 py-3">{coupon.usedCount} / {coupon.usageLimit ?? "∞"} <span className="text-navy/45">({coupon._count.orders} commandes)</span></td><td className="px-4 py-3">{coupon.expiresAt?.toLocaleDateString("fr-FR") ?? "Sans limite"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? "bg-emerald-100 text-emerald-800" : "bg-navy/5 text-navy/55"}`}>{valid ? "Actif" : "Inactif / expiré"}</span></td><td className="whitespace-nowrap px-4 py-3 text-right"><Link className="mr-3 text-xs font-semibold text-navy hover:underline" href={`/admin/coupons/${coupon.id}/modifier`}>Modifier</Link><form action={deleteCoupon.bind(null, coupon.id)} className="inline"><button className="text-xs font-semibold text-rose-dark hover:underline">Désactiver</button></form></td></tr>; })}{!coupons.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-navy/50">Aucun code promo pour le moment.</td></tr>}</tbody></table></div>
  </div>;
}
