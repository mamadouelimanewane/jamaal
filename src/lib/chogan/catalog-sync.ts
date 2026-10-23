/**
 * Synchronisation du catalogue avec le site Chogan (serveur uniquement, jamais appelable du navigateur) :
 * création d'une fiche à partir d'une fiche Chogan, mise à jour automatique des prix, découverte et import
 * automatique des nouveautés. Utilisé par l'import de l'admin et par les tâches planifiées.
 */
import { put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { getCategories } from "@/lib/db-categories";
import { invalidateSearchIndex } from "@/lib/search-index";
import { fetchChoganDetail, fetchChoganImage } from "./client";
import { buildPreview, productSlugRoot, type ChoganPreview } from "./preview";
import { priceUpdate } from "./price-sync";
import type { ChoganDetail } from "./parse";

export type ExistingProduct = { id: string; slug: string; name: string; photo: string | null; galleryCount: number };

/** Fiche JAMAAL déjà liée à ce produit Chogan (n° de fiche, code, ou code d'un de ses formats). */
export async function findExisting(number: number | null, codes: string[]): Promise<ExistingProduct | null> {
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

export async function previewFor(number: number): Promise<{ detail: ChoganDetail; preview: ChoganPreview } | null> {
  const detail = await fetchChoganDetail(number);
  if (!detail) return null;
  const [model, formatCodes] = await Promise.all([getBusinessModel(), formatCodesOf(detail)]);
  return { detail, preview: buildPreview(detail, model, formatCodes) };
}

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Copie les photos Chogan sur le stockage du site ; en cas d'échec, garde l'adresse Chogan. */
export async function storePhotos(number: number, urls: string[]): Promise<string[]> {
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

type Overrides = { name?: string; category?: string; shortDescription?: string; longDescription?: unknown };

/** Crée la fiche (et ses formats) à partir de l'aperçu Chogan. */
export async function createProductFromPreview(preview: ChoganPreview, o: Overrides = {}) {
  const number = preview.number;
  const categories = await getCategories();
  const category = o.category && categories.some((c) => c.slug === o.category) ? o.category : categories.some((c) => c.slug === preview.category) ? preview.category : "autres-produits";
  const name = String(o.name ?? "").trim().slice(0, 160) || preview.name;
  const shortDescription = String(o.shortDescription ?? "").trim().slice(0, 600) || preview.shortDescription;
  const longDescription = (Array.isArray(o.longDescription) ? o.longDescription : preview.longDescription)
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
  invalidateSearchIndex();
  return { id, slug, name, category, photos };
}

/* ---------- Automatique : prix et nouveautés ---------- */

const PROBE_KEY = "chogan_sonde_suivante";
const PROBE_SPAN = 250;

export type SyncReport = { verifies: number; prixMisAJour: number; nouveautes: number; sondes: number; erreurs: number; details: string[] };

/**
 * Tâche planifiée : relit une partie du catalogue chez Chogan et applique les nouveaux prix, puis cherche les
 * fiches Chogan absentes de JAMAAL (formats et teintes voisins des produits connus, puis numéros suivants) et
 * les importe. Respecte le temps imparti (budgetMs). Ne lève jamais d'erreur.
 */
export async function syncChoganCatalog(budgetMs: number, opts: { maxImports?: number } = {}): Promise<SyncReport> {
  const deadline = Date.now() + budgetMs;
  const left = () => deadline - Date.now();
  const report: SyncReport = { verifies: 0, prixMisAJour: 0, nouveautes: 0, sondes: 0, erreurs: 0, details: [] };
  const model = await getBusinessModel();
  const candidates = new Set<number>();

  // 1. Prix : les fiches vérifiées il y a le plus longtemps d'abord.
  const products = await prisma.product.findMany({
    where: { number: { not: null }, isOfficial: true },
    orderBy: [{ choganCheckedAt: { sort: "asc", nulls: "first" } }],
    select: { id: true, name: true, number: true, publicPrice: true, regularPrice: true, volumes: true },
    take: 80,
  });
  for (const p of products) {
    if (left() < budgetMs * 0.4) break; // garder du temps pour les nouveautés
    if (report.erreurs >= 5 && report.verifies === 0) {
      report.details.push("Site Chogan injoignable pour le moment : nouvel essai à la prochaine tâche.");
      return report;
    }
    try {
      const detail = await fetchChoganDetail(p.number!);
      if (detail?.publicPriceEur) {
        detail.formats.forEach((f) => candidates.add(f.number));
        detail.shades.forEach((s) => candidates.add(s.number));
        const update = priceUpdate(p, buildPreview(detail, model));
        // Écart inhabituel (plus de 60 % en hausse ou en baisse) : probable erreur de lecture, l'admin décide.
        const odd = !!update && p.publicPrice != null && p.publicPrice > 0 && (update.publicPrice / p.publicPrice > 1.6 || update.publicPrice / p.publicPrice < 0.6);
        if (update && odd) {
          await prisma.choganPriceChange.create({ data: { productId: p.id, name: p.name, oldPublic: p.publicPrice, newPublic: update.publicPrice } });
          report.details.push(`${p.name} : écart de prix inhabituel, à vérifier`);
        } else if (update) {
          await prisma.product.update({ where: { id: p.id }, data: { publicPrice: update.publicPrice, regularPrice: update.regularPrice, ...(update.volumes ? { volumes: update.volumes as Prisma.InputJsonValue } : {}), choganCheckedAt: new Date() } });
          // Historique (déjà appliqué) : visible dans Stocks › Commande Chogan.
          await prisma.choganPriceChange.create({ data: { productId: p.id, name: p.name, oldPublic: p.publicPrice, newPublic: update.publicPrice, seen: true } });
          report.prixMisAJour++;
          report.details.push(`${p.name} : ${update.changes.join(", ") || "prix public mis à jour"}`);
        }
      }
      report.verifies++;
    } catch {
      report.erreurs++;
    }
    await prisma.product.update({ where: { id: p.id }, data: { choganCheckedAt: new Date() } }).catch(() => {});
  }

  // 2. Nouveautés : voisins des produits connus (nouveaux formats, nouvelles teintes), puis numéros suivants.
  const maxImports = opts.maxImports ?? 5;
  const known = new Set((await prisma.product.findMany({ where: { number: { not: null } }, select: { number: true } })).map((p) => p.number!));
  const maxKnown = known.size ? Math.max(...known) : 0;
  const setting = await prisma.setting.findUnique({ where: { key: PROBE_KEY } }).catch(() => null);
  let next = Math.max(Number(setting?.value) || 0, maxKnown + 1);
  if (next > maxKnown + PROBE_SPAN) next = maxKnown + 1; // rien trouvé loin : on repart des derniers numéros connus
  const queue = [...[...candidates].filter((n) => !known.has(n)), ...Array.from({ length: 40 }, (_, i) => next + i)];
  let probed = next;
  for (const n of queue) {
    if (left() < 8_000 || report.nouveautes >= maxImports || report.erreurs >= 8) break;
    if (n >= next) probed = n + 1;
    if (known.has(n)) continue;
    report.sondes++;
    try {
      const found = await previewFor(n);
      if (!found) continue;
      known.add(n);
      if (await findExisting(n, found.preview.allCodes)) continue;
      const created = await createProductFromPreview(found.preview);
      report.nouveautes++;
      report.details.push(`Nouveau produit importé : ${created.name} (${found.preview.code})`);
    } catch {
      report.erreurs++;
    }
  }
  await prisma.setting.upsert({ where: { key: PROBE_KEY }, create: { key: PROBE_KEY, value: String(probed) }, update: { value: String(probed) } }).catch(() => {});
  return report;
}
