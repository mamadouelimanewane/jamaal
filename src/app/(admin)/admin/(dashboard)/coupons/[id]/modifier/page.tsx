import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCoupon } from "@/lib/actions/coupons";
import { CouponForm } from "@/components/admin/CouponForm";

const local = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : null);

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coupon, consultants] = await Promise.all([
    prisma.coupon.findUnique({ where: { id } }),
    prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
  ]);
  if (!coupon) notFound();
  return (
    <div className="max-w-2xl">
      <Link href="/admin/coupons" className="text-xs text-navy/75 hover:underline">← Codes promotionnels</Link>
      <h1 className="mt-3 font-serif-display text-2xl font-semibold text-navy">Modifier {coupon.code}</h1>
      <CouponForm
        action={updateCoupon.bind(null, id)}
        consultants={consultants}
        submitLabel="Enregistrer"
        initial={{ ...coupon, expiresAt: local(coupon.expiresAt) }}
      />
    </div>
  );
}
