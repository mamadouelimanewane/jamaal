import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCategoriesWithProducts } from "@/lib/db-categories";

/** Rangée « Toutes nos gammes » : une vignette par catégorie qui contient des produits. */
export async function AllRanges() {
  const categories = await getCategoriesWithProducts();
  if (!categories.length) return null;
  const rows = await prisma.product
    .findMany({ where: { photo: { not: null } }, orderBy: [{ reviewCount: "desc" }, { name: "asc" }], select: { category: true, photo: true } })
    .catch(() => []);
  const counts = await prisma.product.groupBy({ by: ["category"], _count: { _all: true } }).catch(() => []);
  const photo = new Map<string, string>();
  for (const r of rows) if (r.photo && !photo.has(r.category)) photo.set(r.category, r.photo);
  const count = new Map(counts.map((c) => [c.category, c._count._all]));

  return (
    <section aria-labelledby="all-ranges" className="border-b border-[#eadfda] bg-[#fdfbfa] py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="luxury-eyebrow">Parfums, soins, maison, bien-être</p>
            <h2 id="all-ranges" className="mt-2 font-serif-display text-3xl font-medium text-navy">Toutes nos gammes</h2>
          </div>
          <p className="text-xs text-navy/60">JAMAAL, revendeur officiel de la marque CHOGAN (Italie)</p>
        </div>
      </div>
      <ul className="mx-auto mt-7 flex max-w-7xl snap-x gap-4 overflow-x-auto px-5 pb-3 sm:px-8 lg:px-12 [scrollbar-width:thin]">
        {categories.map((c) => {
          const src = photo.get(c.slug);
          return (
            <li key={c.slug} className="w-32 shrink-0 snap-start sm:w-36">
              <Link href={`/collections/${c.slug}`} className="group block text-center">
                <span className="relative block aspect-square overflow-hidden rounded-full border border-[#eadfda] bg-white">
                  {src ? (
                    <Image src={src} alt="" fill sizes="144px" className="object-contain p-3 transition duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="flex h-full items-center justify-center font-serif-display text-3xl text-[#9c6254]">{c.navLabel.slice(0, 1)}</span>
                  )}
                </span>
                <span className="mt-3 block text-[13px] font-medium leading-tight text-navy group-hover:underline">{c.navLabel}</span>
                <span className="mt-0.5 block text-[11px] text-navy/50">{count.get(c.slug) ?? 0} produits</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
