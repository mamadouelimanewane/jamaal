"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { normalizeSlides, resetHomeSlides, saveHomeSlides, type HeroSlide } from "@/lib/home-carousel";

export type CarouselResult = { ok: true; slides: HeroSlide[] } | { ok: false; error: string };

export async function saveHomeCarouselAction(slides: HeroSlide[]): Promise<CarouselResult> {
  const session = await requireAdmin();
  const clean = normalizeSlides(slides);
  if (clean.length !== slides.length) return { ok: false, error: "Chaque diapositive doit avoir un slogan." };
  if (!clean.some((s) => s.active)) return { ok: false, error: "Gardez au moins une diapositive affichée." };
  await saveHomeSlides(clean);
  await logActivity(session, `Carrousel d'accueil enregistré (${clean.filter((s) => s.active).length} diapositive(s) affichée(s))`, "Setting");
  revalidatePath("/");
  revalidatePath("/admin/accueil");
  return { ok: true, slides: clean };
}

export async function resetHomeCarouselAction(): Promise<CarouselResult> {
  const session = await requireAdmin();
  await resetHomeSlides();
  await logActivity(session, "Carrousel d'accueil remis par défaut", "Setting");
  revalidatePath("/");
  revalidatePath("/admin/accueil");
  return { ok: true, slides: normalizeSlides(null) };
}
