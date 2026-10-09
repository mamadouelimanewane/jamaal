import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategoriesWithProducts } from "@/lib/db-categories";
import { getHomeSlides } from "@/lib/home-carousel";
import { HomeCarouselEditor } from "@/components/admin/HomeCarouselEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Page d'accueil" };

export default async function HomePageSettings() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const [slides, ranges, rows] = await Promise.all([
    getHomeSlides(),
    getCategoriesWithProducts(),
    prisma.product.findMany({ where: { photo: { not: null } }, orderBy: [{ reviewCount: "desc" }, { name: "asc" }], select: { category: true, photo: true } }),
  ]);
  const photos: Record<string, string> = {};
  for (const r of rows) if (r.photo && !photos[r.category]) photos[r.category] = r.photo;

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Page d&apos;accueil</h1>
      <p className="mt-1 text-sm text-navy/75">
        Le grand carrousel en haut du site : une diapositive par gamme ou par nouveauté, avec votre slogan et un bouton vers la gamme.
        Sans visuel envoyé, la photo d&apos;un produit de la gamme est utilisée. Les visuels Chogan ne sont à utiliser que si votre accord de
        distribution le permet. Sous le carrousel, la rangée « Toutes nos gammes » se met à jour toute seule.
      </p>
      <div className="mt-6">
        <HomeCarouselEditor initial={slides} ranges={ranges.map((c) => ({ slug: c.slug, label: c.navLabel }))} photos={photos} />
      </div>
    </div>
  );
}
