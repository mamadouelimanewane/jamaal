"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import type { CouponType } from "@prisma/client";

function couponDataFromForm(formData: FormData, usedCount = 0) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const typeRaw = String(formData.get("type") ?? "POURCENTAGE");
  const value = Number(formData.get("value") ?? 0);
  const expiresRaw = String(formData.get("expiresAt") ?? "");
  const usageRaw = String(formData.get("usageLimit") ?? "");
  const usageLimit = usageRaw ? Number(usageRaw) : null;
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Code invalide : 3 à 32 lettres, chiffres, tirets ou underscores.");
  if (typeRaw !== "POURCENTAGE" && typeRaw !== "MONTANT_FIXE") throw new Error("Type de promotion invalide.");
  if (!Number.isInteger(value) || value < 1 || value > 10000000 || (typeRaw === "POURCENTAGE" && value > 100)) throw new Error("La valeur du coupon est invalide.");
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < Math.max(1, usedCount))) throw new Error("La limite est inférieure aux utilisations déjà enregistrées.");
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) throw new Error("Date d’expiration invalide.");
  return { code, type: typeRaw as CouponType, value, active: formData.get("active") === "on", expiresAt, usageLimit };
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
  const existing = await prisma.coupon.findUniqueOrThrow({ where: { id }, select: { usedCount: true } });
  await prisma.coupon.update({ where: { id }, data: couponDataFromForm(formData, existing.usedCount) });
  await logActivity(session, "Modification code promo", "Coupon", id);
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function deleteCoupon(id: string) {
  const session = await requireAdmin();
  const existing = await prisma.coupon.findUniqueOrThrow({ where: { id }, select: { usedCount: true } });
  if (existing.usedCount > 0) await prisma.coupon.update({ where: { id }, data: { active: false } });
  else await prisma.coupon.delete({ where: { id } });
  await logActivity(session, existing.usedCount > 0 ? "Désactivation code promo" : "Suppression code promo", "Coupon", id);
  revalidatePath("/admin/coupons");
}
