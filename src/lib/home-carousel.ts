/**
 * Carrousel de la page d'accueil, modifiable dans le back-office (Page d'accueil).
 * Enregistré dans la table Setting (clé « home_carousel »), en JSON. Fichier serveur.
 */
import { prisma } from "./prisma";
import { categoryFromHref, DEFAULT_SLIDES, normalizeSlides, type HeroSlide } from "./home-slides";

export * from "./home-slides";

const KEY = "home_carousel";

export async function getHomeSlides(): Promise<HeroSlide[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row) return DEFAULT_SLIDES;
    return normalizeSlides(JSON.parse(row.value));
  } catch {
    return DEFAULT_SLIDES;
  }
}

export async function saveHomeSlides(slides: HeroSlide[]) {
  const value = JSON.stringify(normalizeSlides(slides));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}

export async function resetHomeSlides() {
  await prisma.setting.deleteMany({ where: { key: KEY } });
}

/** Visuels manquants : photo du produit le plus apprécié de la gamme visée. */
export async function withResolvedImages(slides: HeroSlide[]): Promise<(HeroSlide & { resolvedImage: string | null })[]> {
  const missing = [...new Set(slides.filter((s) => !s.image).map((s) => categoryFromHref(s.href)).filter((c): c is string => !!c))];
  const photos = new Map<string, string>();
  if (missing.length) {
    const rows = await prisma.product
      .findMany({ where: { category: { in: missing }, photo: { not: null } }, orderBy: [{ reviewCount: "desc" }, { name: "asc" }], select: { category: true, photo: true } })
      .catch(() => []);
    for (const r of rows) if (r.photo && !photos.has(r.category)) photos.set(r.category, r.photo);
  }
  return slides.map((s) => ({ ...s, resolvedImage: s.image || photos.get(categoryFromHref(s.href) ?? "") || null }));
}
