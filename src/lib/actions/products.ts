"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { uploadProductImage } from "@/lib/upload";

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

function parseVolumes(value: FormDataEntryValue | null) {
  const lines = splitLines(value);
  const volumes = lines
    .map((line) => {
      const [label, price] = line.split("|").map((s) => s.trim());
      const parsedPrice = Number(price);
      if (!label || !Number.isFinite(parsedPrice)) return null;
      return { label, price: parsedPrice };
    })
    .filter((v): v is { label: string; price: number } => v !== null);
  return volumes.length ? volumes : undefined;
}

function parseVariantStock(value: FormDataEntryValue | null) {
  const lines = splitLines(value);
  return lines
    .map((line) => {
      const [label, stock, threshold] = line.split("|").map((s) => s.trim());
      const parsedStock = Number(stock);
      if (!label || !Number.isFinite(parsedStock)) return null;
      return { label, stock: parsedStock, threshold: threshold ? Number(threshold) || 5 : 5 };
    })
    .filter((v): v is { label: string; stock: number; threshold: number } => v !== null);
}

async function syncVariantStock(productId: string, formData: FormData, userId: string | null) {
  const variants = parseVariantStock(formData.get("variantStock"));
  const labels = variants.map((v) => v.label);
  const removed = await prisma.productVariant.findMany({ where: { productId, volumeLabel: { notIn: labels.length ? labels : ["__none__"] } } });
  for (const variant of removed) {
    if (variant.stock > 0) await prisma.stockMovement.create({ data: { productId, variantId: variant.id, userId, delta: -variant.stock, previousStock: variant.stock, nextStock: 0, reason: "Retrait du format depuis la fiche produit" } });
  }
  await prisma.productVariant.deleteMany({ where: { productId, volumeLabel: { notIn: labels.length ? labels : ["__none__"] } } });

  for (const variant of variants) {
    const existing = await prisma.productVariant.findUnique({ where: { productId_volumeLabel: { productId, volumeLabel: variant.label } } });
    await prisma.productVariant.upsert({
      where: { productId_volumeLabel: { productId, volumeLabel: variant.label } },
      update: { stock: variant.stock, lowStockThreshold: variant.threshold },
      create: { productId, volumeLabel: variant.label, stock: variant.stock, lowStockThreshold: variant.threshold },
    });
    const previousStock = existing?.stock ?? 0;
    if (variant.stock !== previousStock) await prisma.stockMovement.create({
      data: { productId, variantId: existing?.id ?? (await prisma.productVariant.findUniqueOrThrow({ where: { productId_volumeLabel: { productId, volumeLabel: variant.label } }, select: { id: true } })).id, userId, delta: variant.stock - previousStock, previousStock, nextStock: variant.stock, reason: existing ? "Ajustement depuis la fiche produit" : "Stock initial du format" },
    });
  }
}
async function productDataFromForm(formData: FormData) {
  const testerPrice = formData.get("testerPrice");
  const regularPrice = formData.get("regularPrice");
  const numberVal = formData.get("number");
  const badge = String(formData.get("badge") ?? "");

  let photo = String(formData.get("photo") ?? "").trim() || null;
  const photoFile = formData.get("photoFile") as File | null;
  if (photoFile && photoFile.size > 0) {
    photo = await uploadProductImage(photoFile);
  }

  return {
    number: numberVal ? Number(numberVal) : null,
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
    volumes: parseVolumes(formData.get("volumes")) ?? undefined,
    regularPrice: regularPrice ? Number(regularPrice) : null,
    badge: badge || null,
    colorFrom: String(formData.get("colorFrom") ?? "#16233a"),
    colorTo: String(formData.get("colorTo") ?? "#c9997a"),
    photo,
    isOfficial: formData.get("isOfficial") === "on",
    stock: Number(formData.get("stock") ?? 0) || 0,
    lowStockThreshold: Number(formData.get("lowStockThreshold") ?? 5) || 5,
  };
}

export async function createProduct(formData: FormData) {
  const session = await requireAdmin();
  const data = await productDataFromForm(formData);
  const product = await prisma.product.create({ data });
  await syncVariantStock(product.id, formData, session.user?.id ?? null);
  if (data.stock > 0) await prisma.stockMovement.create({ data: { productId: product.id, userId: session.user?.id ?? null, delta: data.stock, previousStock: 0, nextStock: data.stock, reason: "Stock initial du produit" } });
  await logActivity(session, "Création produit", "Product", product.id);
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${data.category}`);
  redirect("/admin/produits");
}

export async function updateProduct(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = await productDataFromForm(formData);
  const previous = await prisma.product.findUnique({ where: { id } });
  await prisma.product.update({ where: { id }, data });
  await syncVariantStock(id, formData, session.user?.id ?? null);
  if (previous && data.stock !== previous.stock) await prisma.stockMovement.create({ data: { productId: id, userId: session.user?.id ?? null, delta: data.stock - previous.stock, previousStock: previous.stock, nextStock: data.stock, reason: "Ajustement depuis la fiche produit" } });
  await logActivity(session, "Modification produit", "Product", id);
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${data.category}`);
  revalidatePath(`/produits/${data.slug}`);
  if (previous && previous.slug !== data.slug) {
    revalidatePath(`/produits/${previous.slug}`);
  }
  redirect("/admin/produits");
}

export async function deleteProduct(id: string) {
  const session = await requireAdmin();
  const product = await prisma.product.delete({ where: { id } });
  await logActivity(session, "Suppression produit", "Product", id);
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${product.category}`);
}
