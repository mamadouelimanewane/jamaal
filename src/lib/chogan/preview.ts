import { salePriceFromPublic, type BusinessModel } from "@/lib/business-model";
import { eurToFcfa, suggestCategory, type ChoganDetail } from "./parse";

/** Ce que l'administrateur voit et peut corriger avant de créer la fiche. Pur. */
export type ChoganPreview = {
  number: number;
  code: string;
  /** Nom proposé pour la fiche JAMAAL : nom Chogan + teinte. */
  name: string;
  shade: string | null;
  format: string | null;
  brand: string | null;
  breadcrumb: string[];
  category: string;
  publicPriceEur: number;
  publicPrice: number;
  regularPrice: number;
  shortDescription: string;
  longDescription: string[];
  images: string[];
  family: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  volumes: { label: string; code: string | null; publicPrice: number; price: number }[] | null;
  /** Codes Chogan de tous les formats (pour détecter un produit déjà au catalogue). */
  allCodes: string[];
  sourceUrl: string;
};

const OFFICIAL = "Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN (Italie).";

const firstSentence = (s: string, max = 170) => {
  const m = s.match(/^(.{20,}?[.!?])(\s|$)/);
  const one = (m ? m[1] : s).trim();
  return one.length > max ? `${one.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : one;
};

export function buildPreview(detail: ChoganDetail, model: BusinessModel, formatCodes: Record<number, string> = {}): ChoganPreview {
  if (!detail.publicPriceEur) throw new Error(`Prix introuvable sur la fiche Chogan ${detail.number}.`);
  const publicPrice = eurToFcfa(detail.publicPriceEur);
  // « Juicy Oil- Huile Lèvres » (coquille du site Chogan) → « Juicy Oil - Huile Lèvres ».
  const base = detail.name.replace(/(\S)- (?=\S)/g, "$1 - ");
  const name = detail.shade && !base.toLowerCase().includes(detail.shade.toLowerCase()) ? `${base} — ${detail.shade}` : base;
  const details = [detail.shade ? `teinte ${detail.shade}` : null, detail.format].filter(Boolean).join(", ");

  const shortDescription = detail.description[0]
    ? `${firstSentence(detail.description[0])} Produit Chogan, distribué au Sénégal par JAMAAL.`
    : `${name}${detail.format ? ` — ${detail.format}` : ""}. Produit Chogan, distribué au Sénégal par JAMAAL.`;
  const longDescription = [...detail.description, ...(details ? [`${name} : ${details}.`] : []), OFFICIAL];

  // Formats (50 ml, 15 ml…) : le format de la fiche importée d'abord, puis les autres.
  const formats = detail.formats.length > 1 ? [...detail.formats].sort((a, b) => (a.number === detail.number ? -1 : b.number === detail.number ? 1 : 0)) : [];
  const volumes = formats.length
    ? formats
        .filter((f) => f.priceEur)
        .map((f) => {
          const pp = eurToFcfa(f.priceEur!);
          return { label: f.label, code: f.number === detail.number ? detail.code : formatCodes[f.number] ?? null, publicPrice: pp, price: salePriceFromPublic(pp, model) };
        })
    : null;

  return {
    number: detail.number,
    code: detail.code,
    name,
    shade: detail.shade,
    format: detail.format,
    brand: detail.brand,
    breadcrumb: detail.breadcrumb,
    category: suggestCategory(detail.breadcrumb, detail.name, detail.code),
    publicPriceEur: detail.publicPriceEur,
    publicPrice,
    regularPrice: salePriceFromPublic(publicPrice, model),
    shortDescription,
    longDescription,
    images: detail.images.slice(0, 8),
    family: detail.notes?.family ?? null,
    topNotes: detail.notes?.top ?? [],
    heartNotes: detail.notes?.heart ?? [],
    baseNotes: detail.notes?.base ?? [],
    volumes: volumes && volumes.length > 1 ? volumes : null,
    allCodes: [...new Set([detail.code, ...Object.values(formatCodes)])],
    sourceUrl: `https://www.chogangroupspa.com/chogangroup/productDetail/${detail.number}`,
  };
}

/** Nom de fichier lisible pour une photo : « MM041-peach-1.jpg ». */
export function photoFileName(code: string, label: string, index: number, url: string): string {
  const ext = (url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const safeCode = code.replace(/[^A-Za-z0-9_-]/g, "");
  return `${safeCode}${slug ? `-${slug}` : ""}-${index + 1}.${ext}`;
}

/** Adresse de fiche : nom raccourci au besoin (sans couper un mot), n° de fiche Chogan toujours entier en suffixe. */
export function productSlugRoot(name: string, number: number): string {
  const full = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const head = full.length <= 60 ? full : full.slice(0, 61).replace(/-[^-]*$/, "");
  return `${head.replace(/-+$/, "") || "produit"}-${number}`;
}
