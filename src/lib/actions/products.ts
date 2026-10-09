"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { uploadProductImage } from "@/lib/upload";
import { invalidateSearchIndex } from "@/lib/search-index";
import { Prisma } from "@prisma/client";

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

type FormatInput = { label: string; code: string | null; price: number; publicPrice: number | null; threshold: number };

/** Formats saisis dans la fiche produit (champ caché JSON du FormatsEditor). */
function parseFormats(value: FormDataEntryValue | null): FormatInput[] | null {
  if (value === null) return null; // champ absent : on ne touche pas aux formats
  let raw: unknown;
  try {
    raw = JSON.parse(String(value) || "[]");
  } catch {
    throw new Error("Formats illisibles.");
  }
  if (!Array.isArray(raw)) throw new Error("Formats illisibles.");
  const seen = new Set<string>();
  return raw.map((r) => {
    const label = String((r as { label?: unknown }).label ?? "").trim().slice(0, 40);
    const price = Math.round(Number((r as { price?: unknown }).price));
    const pub = Number((r as { publicPrice?: unknown }).publicPrice);
    const threshold = Math.max(0, Math.round(Number((r as { threshold?: unknown }).threshold) || 0));
    const code = String((r as { code?: unknown }).code ?? "").trim().toUpperCase().slice(0, 40) || null;
    if (!label) throw new Error("Chaque format doit avoir un nom (ex. 70 ml).");
    if (seen.has(label)) throw new Error(`Le format « ${label} » est saisi deux fois.`);
    seen.add(label);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Prix de vente manquant pour le format « ${label} ».`);
    return { label, code, price, publicPrice: Number.isFinite(pub) && pub > 0 ? Math.round(pub) : null, threshold };
  });
}

function volumesJson(formats: FormatInput[]) {
  return formats.map((f) => ({ label: f.label, price: f.price, ...(f.publicPrice ? { publicPrice: f.publicPrice } : {}), ...(f.code ? { code: f.code } : {}) }));
}

/** Refuse de retirer un format qui a encore du stock (il faut d'abord le sortir dans Stocks). */
async function assertRemovable(productId: string, formats: FormatInput[]) {
  const labels = formats.map((f) => f.label);
  const blocked = await prisma.productVariant.findMany({ where: { productId, stock: { gt: 0 }, volumeLabel: { notIn: labels.length ? labels : ["__aucun__"] } } });
  if (blocked.length) throw new Error(`Le format « ${blocked[0].volumeLabel} » a encore ${blocked[0].stock} unité(s) en stock : sortez-les d'abord dans Stocks.`);
}

/** Aligne les formats en stock (ProductVariant) sur les formats de la fiche. */
async function syncFormats(productId: string, formats: FormatInput[]) {
  const labels = formats.map((f) => f.label);
  await prisma.productVariant.deleteMany({ where: { productId, stock: { lte: 0 }, volumeLabel: { notIn: labels.length ? labels : ["__aucun__"] } } });
  for (const f of formats) {
    await prisma.productVariant.upsert({
      where: { productId_volumeLabel: { productId, volumeLabel: f.label } },
      update: { code: f.code, lowStockThreshold: f.threshold },
      create: { productId, volumeLabel: f.label, code: f.code, lowStockThreshold: f.threshold, stock: 0 },
    });
  }
}

async function productDataFromForm(formData: FormData) {
  const testerPrice = formData.get("testerPrice");
  const regularPrice = formData.get("regularPrice");
  const publicPrice = Number(formData.get("publicPrice") ?? "");
  const numberVal = formData.get("number");
  const badge = String(formData.get("badge") ?? "");

  let photo = String(formData.get("photo") ?? "").trim() || null;
  const photoFile = formData.get("photoFile") as File | null;
  if (photoFile && photoFile.size > 0) {
    photo = await uploadProductImage(photoFile);
  }

  return {
    number: numberVal ? Number(numberVal) : null,
    choganCode: String(formData.get("choganCode") ?? "").trim().toUpperCase() || null,
    inspiredBy: String(formData.get("inspiredBy") ?? "").trim().slice(0, 120) || null,
    inspiredBrand: String(formData.get("inspiredBrand") ?? "").trim().slice(0, 80) || null,
    slug: String(formData.get("slug") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    family: String(formData.get("family") ?? "").trim() || null,
    topNotes: splitList(formData.get("topNotes")),
    heartNotes: splitList(formData.get("heartNotes")),
    baseNotes: splitList(formData.get("baseNotes")),
    shortDescription: String(formData.get("shortDescription") ?? "").trim(),
    longDescription: splitLines(formData.get("longDescription")),
    testerPrice: testerPrice ? Number(testerPrice) : null,

    regularPrice: regularPrice ? Number(regularPrice) : null,
    publicPrice: Number.isFinite(publicPrice) && publicPrice > 0 ? Math.round(publicPrice) : null,
    badge: badge || null,
    colorFrom: String(formData.get("colorFrom") ?? "#1d2f4f"),
    colorTo: String(formData.get("colorTo") ?? "#d9a99d"),
    photo,
    isOfficial: formData.get("isOfficial") === "on",
    stock: Number(formData.get("stock") ?? 0) || 0,
    lowStockThreshold: Number(formData.get("lowStockThreshold") ?? 5) || 5,
  };
}

async function createProductImpl(formData: FormData) {
  const session = await requireAdmin();
  const formats = parseFormats(formData.get("formats")) ?? [];
  const data = await productDataFromForm(formData);
  const product = await prisma.product.create({ data: { ...data, ...(formats.length ? { volumes: volumesJson(formats), stock: 0 } : {}) } });
  invalidateSearchIndex();
  if (formats.length) await syncFormats(product.id, formats);
  if (!formats.length && data.stock > 0) await prisma.stockMovement.create({ data: { productId: product.id, userId: session.user?.id ?? null, delta: data.stock, previousStock: 0, nextStock: data.stock, kind: "RECEPTION", reason: "Stock initial du produit" } });
  await logActivity(session, "Création produit", "Product", product.id);
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${data.category}`);
  redirect("/admin/produits");
}

async function updateProductImpl(id: string, formData: FormData) {
  const session = await requireAdmin();
  const formats = parseFormats(formData.get("formats"));
  const data = await productDataFromForm(formData);
  const previous = await prisma.product.findUnique({ where: { id }, include: { variants: { select: { id: true } } } });
  if (formats) await assertRemovable(id, formats);
  const hasFormats = formats ? formats.length > 0 : !!previous?.variants.length;
  // Produit à formats : le stock se tient par format, la fiche ne le modifie pas.
  const { stock, ...rest } = data;
  await prisma.product.update({
    where: { id },
    data: { ...rest, ...(hasFormats ? {} : { stock }), ...(formats ? { volumes: formats.length ? volumesJson(formats) : Prisma.DbNull } : {}) },
  });
  invalidateSearchIndex();
  if (formats) await syncFormats(id, formats);
  if (!hasFormats && previous && stock !== previous.stock) await prisma.stockMovement.create({ data: { productId: id, userId: session.user?.id ?? null, delta: stock - previous.stock, previousStock: previous.stock, nextStock: stock, kind: "AJUSTEMENT", reason: "Ajustement depuis la fiche produit" } });
  await logActivity(session, "Modification produit", "Product", id);
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${data.category}`);
  revalidatePath(`/produits/${data.slug}`);
  if (previous && previous.slug !== data.slug) {
    revalidatePath(`/produits/${previous.slug}`);
  }
  redirect("/admin/produits");
}

async function deleteProductImpl(id: string) {
  const session = await requireAdmin();
  const product = await prisma.product.delete({ where: { id } });
  invalidateSearchIndex();
  await logActivity(session, "Suppression produit", "Product", id);
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${product.category}`);
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function createProduct(formData: FormData): Promise<void> {
  try {
    await createProductImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/produits");
  }
}

export async function updateProduct(id: string, formData: FormData): Promise<void> {
  try {
    await updateProductImpl(id, formData);
  } catch (e) {
    await backWithError(e, "/admin/produits");
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteProductImpl(id);
  } catch (e) {
    await backWithError(e, "/admin/produits");
  }
}
