"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { invalidateSearchIndex } from "@/lib/search-index";
import { classifyQuery, rankCards, type ChoganCard } from "@/lib/chogan/parse";
import { type ChoganPreview } from "@/lib/chogan/preview";
import { createProductFromPreview, findExisting, previewFor, storePhotos, type ExistingProduct } from "@/lib/chogan/catalog-sync";
import { ChoganError, fetchChoganDetail, searchChogan } from "@/lib/chogan/client";

export type { ExistingProduct };

export type ResolveResult =
  | { status: "found"; preview: ChoganPreview }
  | { status: "exists"; preview: ChoganPreview | null; existing: ExistingProduct }
  | { status: "choose"; candidates: (ChoganCard & { existingId: string | null })[]; message?: string; missing?: { number: number; name: string }[]; total?: number }
  | { status: "notfound"; message: string }
  | { status: "error"; message: string };

const errorMessage = (e: unknown) => (e instanceof ChoganError ? e.message : e instanceof Error ? e.message : "Erreur inattendue.");

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
    // Recherche large (« Aurodhea », « soin visage »…) : toutes les fiches absentes du catalogue, pour les ajouter d'un coup.
    const all = cards.slice(0, 40);
    const missing: { number: number; name: string }[] = [];
    for (const c of all) if (!(await findExisting(c.number, [c.code]))) missing.push({ number: c.number, name: c.name });
    return { status: "choose", candidates: await candidatesOf(cards), missing, total: cards.length };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
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

    const created = await createProductFromPreview(preview, { name: input.name, category: input.category, shortDescription: input.shortDescription, longDescription: input.longDescription });
    const { id, slug, name, category, photos } = created;
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
