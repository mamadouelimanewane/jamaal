"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";

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

function productDataFromForm(formData: FormData) {
  const testerPrice = formData.get("testerPrice");
  const regularPrice = formData.get("regularPrice");
  const numberVal = formData.get("number");
  const badge = String(formData.get("badge") ?? "");

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
    photo: String(formData.get("photo") ?? "").trim() || null,
    isOfficial: formData.get("isOfficial") === "on",
    stock: Number(formData.get("stock") ?? 0) || 0,
    lowStockThreshold: Number(formData.get("lowStockThreshold") ?? 5) || 5,
  };
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const data = productDataFromForm(formData);
  await prisma.product.create({ data });
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${data.category}`);
  redirect("/admin/produits");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const data = productDataFromForm(formData);
  const previous = await prisma.product.findUnique({ where: { id } });
  await prisma.product.update({ where: { id }, data });
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${data.category}`);
  revalidatePath(`/produits/${data.slug}`);
  if (previous && previous.slug !== data.slug) {
    revalidatePath(`/produits/${previous.slug}`);
  }
  redirect("/admin/produits");
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const product = await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/produits");
  revalidatePath(`/collections/${product.category}`);
}
