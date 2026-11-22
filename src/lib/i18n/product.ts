import type { Product } from "@/data/types";
import type { Locale } from "./config";
import { familyIt, noteIt } from "./notes-it";
import { familyAr, noteAr } from "./notes-ar";

/** Phrases types des fiches importées du catalogue Chogan, traduites quand aucun texte italien n'est saisi. */
const GENERIC: [RegExp, string][] = [
  [/\. Produit Chogan, distribué au Sénégal par JAMAAL\.$/, ". Prodotto Chogan, distribuito in Senegal da JAMAAL."],
  [/\. Produit Chogan\.$/, ". Prodotto Chogan."],
  [/ Format : ([^.]+)\.$/, " Formato: $1."],
  [/^Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN \(Italie\)\.$/, "Prodotto ufficiale della gamma Chogan, distribuito in Senegal da JAMAAL, rivenditore ufficiale del marchio CHOGAN (Italia)."],
  [/^Extrait de parfum concentré à 30 %\.$/, "Estratto di profumo concentrato al 30 %."],
];

export function genericIt(text: string): string {
  return GENERIC.reduce((s, [re, to]) => s.replace(re, to), text);
}

/** Mêmes phrases types en arabe. */
const GENERIC_AR: [RegExp, string][] = [
  [/\. Produit Chogan, distribué au Sénégal par JAMAAL\.$/, ". منتج Chogan، توزّعه JAMAAL في السنغال."],
  [/\. Produit Chogan\.$/, ". منتج Chogan."],
  [/ Format : ([^.]+)\.$/, " الحجم: $1."],
  [/^Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN \(Italie\)\.$/, "منتج رسمي من مجموعة Chogan، توزّعه في السنغال JAMAAL، الموزّع الرسمي لعلامة CHOGAN (إيطاليا)."],
  [/^Extrait de parfum concentré à 30 %\.$/, "مستخلص عطر مركّز بنسبة 30٪."],
];

export function genericAr(text: string): string {
  return GENERIC_AR.reduce((s, [re, to]) => s.replace(re, to), text);
}

/** Fiche produit dans la langue voulue : textes italiens saisis (sinon français), notes et famille traduites ; en arabe, phrases types, notes et famille. */
export function localizeProduct<P extends Product>(p: P, locale: Locale): P {
  if (locale === "ar") {
    // Pas encore de texte arabe saisi en base : phrases types, notes et famille traduites, sinon le français.
    const notes = (l?: string[]) => (l ? l.map(noteAr) : l);
    return {
      ...p,
      shortDescription: genericAr(p.shortDescription),
      longDescription: p.longDescription.map(genericAr),
      family: p.family ? familyAr(p.family) : p.family,
      topNotes: notes(p.topNotes),
      heartNotes: notes(p.heartNotes),
      baseNotes: notes(p.baseNotes),
    };
  }
  if (locale !== "it") return p;
  const notes = (l?: string[]) => (l ? l.map(noteIt) : l);
  return {
    ...p,
    shortDescription: p.shortDescriptionIt?.trim() ? p.shortDescriptionIt : genericIt(p.shortDescription),
    longDescription: p.longDescriptionIt?.length ? p.longDescriptionIt : p.longDescription.map(genericIt),
    family: p.family ? familyIt(p.family) : p.family,
    topNotes: notes(p.topNotes),
    heartNotes: notes(p.heartNotes),
    baseNotes: notes(p.baseNotes),
  };
}
