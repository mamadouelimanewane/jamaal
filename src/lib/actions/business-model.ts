"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getBusinessModel, saveBusinessModel } from "@/lib/business-model-store";
import { normalizeBusinessModel, salePriceFromPublic, type BusinessModel, type PrimeTier } from "@/lib/business-model";

export type BusinessModelState = { ok: boolean; message?: string; error?: string };

const PCT_FIELDS = [
  "purchasePct",
  "salePct",
  "sellerPct",
  "sponsorAlonePct",
  "sponsorSharedPct",
  "grandSponsorPct",
  "shippingPct",
  "miscPct",
] as const;

function readNumber(formData: FormData, name: string): number {
  const raw = String(formData.get(name) ?? "").replace(",", ".").replace(/\s/g, "");
  return Number(raw);
}

/** Enregistre le modèle économique (taux, coûts, primes). */
export async function saveBusinessModelAction(_prev: BusinessModelState, formData: FormData): Promise<BusinessModelState> {
  const session = await requireAdmin();

  const input: Partial<BusinessModel> = {};
  for (const field of PCT_FIELDS) {
    const v = readNumber(formData, field);
    if (!Number.isFinite(v) || v < 0 || v > (field === "salePct" || field === "purchasePct" ? 1000 : 100)) {
      return { ok: false, error: `Valeur invalide pour « ${field} ».` };
    }
    input[field] = v;
  }
  if (input.salePct! <= input.purchasePct!) {
    return { ok: false, error: "Le prix de vente doit être supérieur au prix d'achat." };
  }
  const rounding = readNumber(formData, "priceRounding");
  if (!Number.isFinite(rounding) || rounding < 1) return { ok: false, error: "Arrondi des prix invalide." };
  input.priceRounding = Math.round(rounding);

  const topBonus = readNumber(formData, "topSellerBonus");
  input.topSellerBonus = Number.isFinite(topBonus) && topBonus > 0 ? Math.round(topBonus) : 0;
  input.primesEnabled = formData.get("primesEnabled") === "on";

  // Réseau, paiements et versements
  const maxRecruits = readNumber(formData, "maxDirectRecruits");
  input.maxDirectRecruits = Number.isFinite(maxRecruits) && maxRecruits >= 0 ? Math.round(maxRecruits) : 10;
  const minPayout = readNumber(formData, "minPayout");
  input.minPayout = Number.isFinite(minPayout) && minPayout > 0 ? Math.round(minPayout) : 0;
  input.acceptWave = formData.get("acceptWave") === "on";
  input.acceptOrangeMoney = formData.get("acceptOrangeMoney") === "on";
  input.acceptCard = formData.get("acceptCard") === "on";
  input.acceptCashOnDelivery = formData.get("acceptCashOnDelivery") === "on";
  input.payoutsEnabled = formData.get("payoutsEnabled") === "on";
  input.payoutTrigger = formData.get("payoutTrigger") === "DELIVERED" ? "DELIVERED" : "PAID";

  // Livraison
  const depotLat = readNumber(formData, "depotLat");
  const depotLng = readNumber(formData, "depotLng");
  if (!Number.isFinite(depotLat) || !Number.isFinite(depotLng) || Math.abs(depotLat) > 90 || Math.abs(depotLng) > 180) {
    return { ok: false, error: "Position du dépôt invalide : placez-la sur la carte." };
  }
  input.depotLat = depotLat;
  input.depotLng = depotLng;
  input.depotLabel = String(formData.get("depotLabel") ?? "").trim().slice(0, 120) || "Dépôt JAMAAL";
  for (const key of ["deliveryBaseFee", "deliveryIncludedKm", "deliveryPerKm", "deliveryMaxKm", "deliveryFreeAbove", "livreurSharePct"] as const) {
    const v = readNumber(formData, key);
    if (!Number.isFinite(v) || v < 0 || (key === "livreurSharePct" && v > 100)) return { ok: false, error: "Valeur de livraison invalide." };
    input[key] = v;
  }

  const thresholds = formData.getAll("tierThreshold");
  const amounts = formData.getAll("tierAmount");
  const extras = formData.getAll("tierExtra");
  const tiers: PrimeTier[] = [];
  thresholds.forEach((t, i) => {
    const threshold = Number(String(t).replace(/\s/g, ""));
    const amount = Number(String(amounts[i] ?? "").replace(/\s/g, ""));
    if (Number.isFinite(threshold) && threshold > 0 && Number.isFinite(amount) && amount >= 0) {
      tiers.push({ threshold: Math.round(threshold), amount: Math.round(amount), extra: String(extras[i] ?? "").trim() || undefined });
    }
  });
  input.primeTiers = tiers;

  const previous = await getBusinessModel();
  const next = normalizeBusinessModel({ ...previous, ...input });
  await saveBusinessModel(next);
  await logActivity(session, "Modification du modèle économique", "Setting", "business_model");

  for (const path of ["/admin/modele-economique", "/admin/mes-gains", "/admin/mes-filleuls", "/admin/comptabilite", "/admin"]) {
    revalidatePath(path);
  }
  return { ok: true, message: "Modèle économique enregistré. Les commissions affichées utilisent déjà ces taux." };
}

/**
 * Recalcule le prix de vente de chaque produit ayant un prix public Chogan :
 * prix de vente = prix public × % de vente, arrondi.
 */
export async function applyCatalogPricingAction(): Promise<BusinessModelState> {
  const session = await requireAdmin();
  const model = await getBusinessModel();
  const products = await prisma.product.findMany({
    where: { publicPrice: { gt: 0 } },
    select: { id: true, publicPrice: true, regularPrice: true },
  });

  const changes = products
    .map((p) => ({ id: p.id, price: salePriceFromPublic(p.publicPrice!, model), previous: p.regularPrice }))
    .filter((p) => p.price !== p.previous);

  // Par lots, pour ne pas dépasser les limites de transaction de Neon.
  for (let i = 0; i < changes.length; i += 100) {
    await prisma.$transaction(changes.slice(i, i + 100).map((c) => prisma.product.update({ where: { id: c.id }, data: { regularPrice: c.price } })));
  }
  await logActivity(session, `Mise à jour des prix (${changes.length} produits, vente = ${model.salePct} % du prix public)`, "Product");

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: changes.length
      ? `${changes.length} prix mis à jour sur ${products.length} produits ayant un prix public.`
      : `Aucun changement : les ${products.length} produits sont déjà au bon prix.`,
  };
}
