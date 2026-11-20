"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getReseller } from "@/lib/reseller";
import { canonicalizePhone } from "@/lib/phone";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";

export type GroupDealResult = { ok: true; url?: string; joined?: number; target?: number; couponCode?: string; unlocked?: boolean } | { ok: false; error: string };

export async function createGroupDeal(input: { title: string; description?: string; productId: string; volumeLabel: string; targetCount: number; discountPct: number; days: number }): Promise<GroupDealResult> {
  const me = await getReseller();
  if (!me || me.viewAs) return { ok: false, error: "Connectez-vous à votre espace vendeur pour créer une offre." };
  const title = String(input.title ?? "").trim().slice(0, 80);
  const description = String(input.description ?? "").trim().slice(0, 280);
  const volumeLabel = String(input.volumeLabel ?? "").trim().slice(0, 60);
  const targetCount = Math.round(Number(input.targetCount));
  const discountPct = Math.round(Number(input.discountPct));
  const days = Math.round(Number(input.days));
  if (title.length < 4 || !input.productId || !volumeLabel || targetCount < 2 || targetCount > 30 || discountPct < 5 || discountPct > 40 || days < 1 || days > 14) return { ok: false, error: "Vérifiez le titre, le produit, le nombre de participants (2 à 30), la remise (5 à 40 %) et la durée (1 à 14 jours)." };
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true, volumes: true, regularPrice: true, stock: true, variants: { select: { volumeLabel: true, stock: true } } } });
  if (!product) return { ok: false, error: "Produit introuvable." };
  const volumes = (product.volumes as { label?: string; price?: number }[] | null) ?? [];
  const volume = volumes.find((v) => v.label === volumeLabel);
  const stock = product.variants.length ? product.variants.find((v) => v.volumeLabel === volumeLabel)?.stock ?? 0 : product.stock;
  if (stock <= 0 || !(volume?.price || product.regularPrice)) return { ok: false, error: "Ce format n’est pas disponible actuellement." };
  const deal = await prisma.groupDeal.create({ data: { title, description, productId: product.id, volumeLabel, targetCount, discountPct, consultantId: me.id, expiresAt: new Date(Date.now() + days * 86_400_000) }, select: { id: true } });
  const origin = await getSiteUrl();
  const url = `${origin}/achat-groupe/${deal.id}${me.slug ? `?ref=${encodeURIComponent(me.slug)}` : ""}`;
  revalidatePath("/admin/achats-groupes");
  return { ok: true, url };
}

async function unlockDeal(dealId: string) {
  const deal = await prisma.groupDeal.findUnique({ where: { id: dealId }, select: { id: true, status: true, targetCount: true, discountPct: true, expiresAt: true, participants: { select: { id: true, couponCode: true } } } });
  if (!deal || deal.status !== "OPEN" || deal.expiresAt <= new Date() || deal.participants.length < deal.targetCount) return;
  await prisma.groupDeal.updateMany({ where: { id: deal.id, status: "OPEN" }, data: { status: "ATTEINT" } });
  const couponExpiresAt = new Date(Math.min(deal.expiresAt.getTime(), Date.now() + 3 * 86_400_000));
  for (const member of deal.participants) {
    const code = member.couponCode ?? `GR${deal.id.slice(-5)}${member.id.slice(-6)}`.toUpperCase();
    await prisma.coupon.upsert({ where: { code }, create: { code, type: "POURCENTAGE", value: deal.discountPct, active: true, usageLimit: 1, expiresAt: couponExpiresAt }, update: {} });
    await prisma.groupDealParticipant.updateMany({ where: { id: member.id, couponCode: null }, data: { couponCode: code } });
  }
}

export async function joinGroupDeal(dealId: string, input: { name: string; phone: string }): Promise<GroupDealResult> {
  const limited = await rateLimit(`group-deal:${clientIpFromHeaders(await headers())}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!limited.ok) return { ok: false, error: "Trop de tentatives. Réessayez dans une heure." };
  if (!/^[a-z0-9_-]{12,64}$/i.test(dealId)) return { ok: false, error: "Offre introuvable." };
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = canonicalizePhone(String(input.phone ?? ""));
  if (name.length < 2) return { ok: false, error: "Indiquez votre nom." };
  if (phone.length < 9 || phone.length > 15) return { ok: false, error: "Indiquez un numéro de téléphone valide." };
  const deal = await prisma.groupDeal.findUnique({ where: { id: dealId }, select: { id: true, status: true, targetCount: true, expiresAt: true } });
  if (!deal || deal.expiresAt <= new Date() || deal.status === "EXPIREE") {
    if (deal) await prisma.groupDeal.updateMany({ where: { id: deal.id, status: "OPEN" }, data: { status: "EXPIREE" } });
    return { ok: false, error: "Cette offre de groupe a expiré." };
  }
  const previous = await prisma.groupDealParticipant.findUnique({ where: { dealId_phone: { dealId, phone } }, select: { id: true, couponCode: true } });
  if (previous) {
    if (deal.status === "ATTEINT" && !previous.couponCode) await unlockDeal(dealId);
    const joined = await prisma.groupDealParticipant.count({ where: { dealId } });
    const member = previous.couponCode ? previous : await prisma.groupDealParticipant.findUnique({ where: { dealId_phone: { dealId, phone } }, select: { couponCode: true } });
    return { ok: true, joined, target: deal.targetCount, couponCode: member?.couponCode ?? undefined, unlocked: !!member?.couponCode };
  }
  if (deal.status !== "OPEN") return { ok: false, error: "Le groupe a déjà atteint son objectif. Les codes de réduction ont été débloqués pour les participants." };
  try {
    await prisma.groupDealParticipant.create({ data: { dealId, name, phone } });
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
  }
  const joined = await prisma.groupDealParticipant.count({ where: { dealId } });
  if (joined >= deal.targetCount) await unlockDeal(dealId);
  const member = await prisma.groupDealParticipant.findUnique({ where: { dealId_phone: { dealId, phone } }, select: { couponCode: true } });
  revalidatePath(`/achat-groupe/${dealId}`);
  revalidatePath("/admin/achats-groupes");
  return { ok: true, joined, target: deal.targetCount, couponCode: member?.couponCode ?? undefined, unlocked: !!member?.couponCode };
}
