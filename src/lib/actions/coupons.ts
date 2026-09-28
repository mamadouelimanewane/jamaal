"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import type { CouponType } from "@prisma/client";

function couponDataFromForm(formData: FormData) {
  const expiresAtRaw = String(formData.get("expiresAt") ?? "");
  const usageLimitRaw = String(formData.get("usageLimit") ?? "");
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    type: String(formData.get("type") ?? "POURCENTAGE") as CouponType,
    value: Number(formData.get("value") ?? 0) || 0,
    active: formData.get("active") === "on",
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
  };
}

export async function createCoupon(formData: FormData) {
  const session = await requireAdmin();
  const coupon = await prisma.coupon.create({ data: couponDataFromForm(formData) });
  await logActivity(session, "Création code promo", "Coupon", coupon.id);
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function updateCoupon(id: string, formData: FormData) {
  const session = await requireAdmin();
  await prisma.coupon.update({ where: { id }, data: couponDataFromForm(formData) });
  await logActivity(session, "Modification code promo", "Coupon", id);
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function deleteCoupon(id: string) {
  const session = await requireAdmin();
  await prisma.coupon.delete({ where: { id } });
  await logActivity(session, "Suppression code promo", "Coupon", id);
  revalidatePath("/admin/coupons");
}
