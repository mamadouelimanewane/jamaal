import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCoupon } from "@/lib/actions/coupons";
import { CouponForm } from "@/components/admin/CouponForm";

export default async function NewCouponPage() {
  const consultants = await prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-2xl">
      <Link href="/admin/coupons" className="text-xs text-navy/75 hover:underline">← Codes promotionnels</Link>
      <h1 className="mt-3 font-serif-display text-2xl font-semibold text-navy">Créer un code promo</h1>
      <p className="mt-1 text-sm text-navy/75">Choisissez pour qui et l&apos;avantage : le système crée le code, puis vous copiez le lien ou l&apos;envoyez sur WhatsApp.</p>
      <CouponForm action={createCoupon} consultants={consultants} submitLabel="Créer le code" />
    </div>
  );
}
