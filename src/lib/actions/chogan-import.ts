"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getBusinessModel } from "@/lib/business-model-store";
import { invalidateSearchIndex } from "@/lib/search-index";
import { getCategories } from "@/lib/db-categories";
import { classifyQuery, rankCards, type ChoganCard, type ChoganDetail } from "@/lib/chogan/parse";
import { buildPreview, productSlugRoot, type ChoganPreview } from "@/lib/chogan/preview";
import { ChoganError, fetchChoganDetail, fetchChoganImage, searchChogan } from "@/lib/chogan/client";

export type ExistingProduct = { id: string; slug: string; name: string; photo: string | null; galleryCount: number };

export type ResolveResult =
  | { status: "found"; preview: ChoganPreview }
  | { status: "exists"; preview: ChoganPreview | null; existing: ExistingProduct }
  | { status: "choose"; candidates: (ChoganCard & { existingId: string | null })[]; message?: string }
  | { status: "notfound"; message: string }
  | { status: "error"; message: string };

const errorMessage = (e: unknown) => (e instanceof ChoganError ? e.message : e instanceof Error ? e.message : "Erreur inattendue.");

/** Fiche JAMAAL déjà liée à ce produit Chogan (n° de fiche, code, ou code d'un de ses formats). */
async function findExisting(number: number | null, codes: string[]): Promise<ExistingProduct | null> {
  const cleanCodes = codes.filter(Boolean);
  const or = [
    ...(number ? [{ number }, { id: `chogan-${number}` }] : []),
    ...cleanCodes.map((c) => ({ choganCode: { equals: c, mode: "insensitive" as const } })),
    ...(cleanCodes.length ? [{ variants: { some: { OR: cleanCodes.map((c) => ({ code: { equals: c, mode: "insensitive" as const } })) } } }] : []),
  ];
  if (!or.length) return null;
  const p = await prisma.product.findFirst({ where: { OR: or }, select: { id: true, slug: true, name: true, photo: true, gallery: true } });
  return p ? { id: p.id, slug: p.slug, name: p.name, photo: p.photo, galleryCount: p.gallery.length } : null;
}

/** Codes Chogan des autres formats d'un parfum (chaque format est une fiche à part). */
async function formatCodesOf(detail: ChoganDetail): Promise<Record<number, string>> {
  const codes: Record<number, string> = {};
  for (const f of detail.formats.slice(0, 5)) {
    if (f.number === detail.number) continue;
    const other = await fetchChoganDetail(f.number).catch(() => null);
    if (other) codes[f.number] = other.code;
  }
  return codes;
}

async function previewFor(number: number): Promise<{ detail: ChoganDetail; preview: ChoganPreview } | null> {
  const detail = await fetchChoganDetail(number);
  if (!detail) return null;
  const [model, formatCodes] = await Promise.all([getBusinessModel(), formatCodesOf(detail)]);
  return { detail, preview: buildPreview(detail, model, formatCodes) };
}

/**
 * N° de fiche d'un code : recherche Chogan (code identique), sinon nuancier d'une teinte sœur en
 * base. Renvoie aussi les cartes de la recherche, pour proposer des codes proches (MM07 → MM070).
 */
async function numberForCode(code: string): Promise<{ number: number | null; cards: ChoganCard[] }> {
  const cards = await searchChogan(code);
  const exact = cards.find((c) => c.code.toUpperCase() === code);
  if (exact) return { number: exact.number, cards };
  const prefix = code.replace(/\d$/, "");
  if (prefix.length < 3 || prefix === code) return { number: null, cards };
  const sister = await prisma.product.findFirst({ where: { choganCode: { startsWith: prefix, mode: "insensitive" }, number: { not: null } }, select: { number: true } });
  if (!sister?.number) return { number: null, cards };
  const d = await fetchChoganDetail(sister.number).catch(() => null);
  return { number: d?.shades.find((s) => s.code.toUpperCase() === code)?.number ?? null, cards };
}

async function candidatesOf(cards: ChoganCard[]) {
  return Promise.all(cards.slice(0, 5).map(async (c) => ({ ...c, existingId: (await findExisting(c.number, [c.code]))?.id ?? null })));
}

async function resultFor(number: number): Promise<ResolveResult> {
  const found = await previewFor(number);
  if (!found) return { status: "notfound", message: `Aucune fiche Chogan n° ${number}.` };
  const existing = await findExisting(number, found.preview.allCodes);
  return existing ? { status: "exists", preview: found.preview, existing } : { status: "found", preview: found.preview };
}

/** Une ligne de la saisie (lien, n° de fiche, code ou nom) → fiche Chogan trouvée, à préciser ou introuvable. */
export async function resolveChoganQuery(raw: string): Promise<ResolveResult> {
  await requireAdmin("catalogue");
  const q = classifyQuery(String(raw ?? "").slice(0, 300));
  if (!q) return { status: "notfound", message: "Saisie vide." };
  try {
    if (q.kind === "number") {
      const r = await resultFor(q.number);
      // « 1008 » peut aussi être un code Chogan à 4 chiffres : on tente la recherche par code.
      if (r.status === "notfound" && /^\d+$/.test(q.raw)) {
        const { number: n } = await numberForCode(q.raw);
        if (n) return resultFor(n);
      }
      return r;
    }

    if (q.kind === "code") {
      const { number: n, cards } = await numberForCode(q.code);
      if (n) return resultFor(n);
      const existing = await findExisting(null, [q.code]);
      if (existing) return { status: "exists", preview: null, existing };
      // Code inexact (faute de frappe, chiffre manquant) : on propose les codes proches de la recherche Chogan.
      const close = rankCards(q.code, cards).filter((c) => c.code.toUpperCase().startsWith(q.code) || q.code.startsWith(c.code.toUpperCase().replace(/\d+$/, "")));
      if (close.length) return { status: "choose", candidates: await candidatesOf(close), message: `Code ${q.code} introuvable tel quel chez Chogan. Codes proches :` };
      return { status: "notfound", message: `Code ${q.code} introuvable chez Chogan : collez le lien de sa fiche.` };
    }

    const cards = rankCards(q.text, await searchChogan(q.text));
    if (!cards.length) return { status: "notfound", message: `Aucun produit Chogan pour « ${q.text} ».` };
    const exactCode = cards.filter((c) => c.code.toUpperCase() === q.text.replace(/\s+/g, "").toUpperCase());
    if (exactCode.length === 1) return resultFor(exactCode[0].number);
    if (cards.length === 1) return resultFor(cards[0].number);
    return { status: "choose", candidates: await candidatesOf(cards) };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  }
}

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Copie les photos Chogan sur le stockage du site ; en cas d'échec, garde l'adresse Chogan. */
async function storePhotos(number: number, urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const [i, url] of urls.entries()) {
    if (!hasBlob()) {
      out.push(url);
      continue;
    }
    try {
      const { data, contentType } = await fetchChoganImage(url);
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const blob = await put(`produits/chogan/${number}-${i + 1}.${ext}`, Buffer.from(data), { access: "public", addRandomSuffix: true, contentType });
      out.push(blob.url);
    } catch {
      out.push(url);
    }
  }
  return out;
}

async function uniqueProductSlug(name: string, number: number): Promise<string> {
  const root = productSlugRoot(name, number);
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    if (!(await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
}

export type ImportInput = {
  number: number;
  name: string;
  category: string;
  shortDescription: string;
  longDescription: string[];
};

export type ImportResult = { ok: true; id: string; slug: string; name: string; photo: string | null } | { ok: false; error: string; existingId?: string };

/** Crée une fiche JAMAAL à partir d'une fiche Chogan. Prix et photos sont relus chez Chogan (jamais pris du navigateur). */
export async function importChoganProduct(input: ImportInput): Promise<ImportResult> {
  const session = await requireAdmin("catalogue");
  try {
    const number = Number(input?.number);
    const found = await previewFor(number);
    if (!found) return { ok: false, error: `Fiche Chogan n° ${number} introuvable.` };
    const { preview } = found;
    const existing = await findExisting(number, preview.allCodes);
    if (existing) return { ok: false, error: `Déjà au catalogue : ${existing.name}.`, existingId: existing.id };

    const categories = await getCategories();
    const category = categories.some((c) => c.slug === input.category) ? input.category : categories.some((c) => c.slug === preview.category) ? preview.category : "autres-produits";
    const name = String(input.name ?? "").trim().slice(0, 160) || preview.name;
    const shortDescription = String(input.shortDescription ?? "").trim().slice(0, 600) || preview.shortDescription;
    const longDescription = (Array.isArray(input.longDescription) ? input.longDescription : preview.longDescription)
      .map((l) => String(l).trim().slice(0, 2000))
      .filter(Boolean)
      .slice(0, 12);

    const photos = await storePhotos(number, preview.images);
    const id = `chogan-${number}`;
    const slug = await uniqueProductSlug(name, number);

    await prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          id,
          number,
          choganCode: preview.code,
          slug,
          name,
          category,
          family: preview.family,
          topNotes: preview.topNotes,
          heartNotes: preview.heartNotes,
          baseNotes: preview.baseNotes,
          shortDescription,
          longDescription: longDescription.length ? longDescription : preview.longDescription,
          volumes: preview.volumes ?? undefined,
          publicPrice: preview.publicPrice,
          regularPrice: preview.regularPrice,
          photo: photos[0] ?? null,
          gallery: photos.slice(1),
          isOfficial: true,
          stock: 0,
          lowStockThreshold: 5,
          colorFrom: "#1d2f4f",
          colorTo: "#d9a99d",
        },
      });
      if (preview.volumes) {
        await tx.productVariant.createMany({
          data: preview.volumes.map((v, i) => ({ id: `var-${id}-${i}`, productId: id, volumeLabel: v.label, code: v.code, stock: 0, lowStockThreshold: i === 0 ? 5 : 3 })),
          skipDuplicates: true,
        });
      }
    });

    await logActivity(session, `Import Chogan : ${name} (${preview.code}, fiche ${number})`, "Product", id);
    invalidateSearchIndex();
    revalidatePath("/admin/produits");
    revalidatePath(`/produits/${slug}`);
    revalidatePath(`/collections/${category}`);
    return { ok: true, id, slug, name, photo: photos[0] ?? null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Remplace les photos d'une fiche existante par celles de sa fiche Chogan. */
export async function refreshChoganPhotos(productId: string, number?: number): Promise<{ ok: boolean; error?: string; photo?: string | null; count?: number }> {
  const session = await requireAdmin("catalogue");
  try {
    const product = await prisma.product.findUnique({ where: { id: String(productId) }, select: { id: true, slug: true, name: true, number: true } });
    if (!product) return { ok: false, error: "Fiche introuvable." };
    const n = product.number ?? (Number.isInteger(number) ? Number(number) : null);
    if (!n) return { ok: false, error: "Cette fiche n'a pas de n° Chogan." };
    const detail = await fetchChoganDetail(n);
    if (!detail || !detail.images.length) return { ok: false, error: "Aucune photo sur la fiche Chogan." };
    const photos = await storePhotos(n, detail.images.slice(0, 8));
    await prisma.product.update({ where: { id: product.id }, data: { photo: photos[0], gallery: photos.slice(1), ...(product.number ? {} : { number: n }) } });
    await logActivity(session, `Photos Chogan mises à jour : ${product.name} (fiche ${n})`, "Product", product.id);
    invalidateSearchIndex();
    revalidatePath("/admin/produits");
    revalidatePath(`/produits/${product.slug}`);
    return { ok: true, photo: photos[0], count: photos.length };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
