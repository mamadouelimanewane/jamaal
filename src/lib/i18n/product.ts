import type { Product } from "@/data/types";
import type { Locale } from "./config";
import { familyIt, noteIt } from "./notes-it";
import { familyAr, noteAr } from "./notes-ar";
import { familyEn, noteEn } from "./notes-en";

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

/** Mêmes phrases types en anglais (version gambienne). */
const GENERIC_EN: [RegExp, string][] = [
  [/\. Produit Chogan, distribué au Sénégal par JAMAAL\.$/, ". Chogan product, distributed in Senegal by JAMAAL."],
  [/\. Produit Chogan\.$/, ". Chogan product."],
  [/ Format : ([^.]+)\.$/, " Size: $1."],
  [/^Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN \(Italie\)\.$/, "Official product from the Chogan range, distributed in Senegal by JAMAAL, official reseller of the CHOGAN brand (Italy)."],
  [/^Extrait de parfum concentré à 30 %\.$/, "Perfume extract concentrated at 30%."],
];

export function genericEn(text: string): string {
  return GENERIC_EN.reduce((s, [re, to]) => s.replace(re, to), text);
}

/** Fiche produit dans la langue voulue : textes italiens saisis (sinon français), notes et famille traduites ; en arabe, phrases types, notes et famille. */
export function localizeProduct<P extends Product>(p: P, locale: Locale): P {
  if (locale === "ar" || locale === "en") {
    // Pas encore de texte arabe ou anglais saisi en base : phrases types, notes et famille traduites, sinon le français.
    const [generic, note, family] = locale === "ar" ? [genericAr, noteAr, familyAr] : [genericEn, noteEn, familyEn];
    const notes = (l?: string[]) => (l ? l.map(note) : l);
    return {
      ...p,
      shortDescription: generic(p.shortDescription),
      longDescription: p.longDescription.map(generic),
      family: p.family ? family(p.family) : p.family,
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
