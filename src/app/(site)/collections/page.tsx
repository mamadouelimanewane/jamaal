import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/db-categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Toute la gamme",
  description:
    "Parfums, soins visage et corps, maquillage, nutrition, maison : toute la gamme Chogan distribuée au Sénégal par JAMAAL.",
};

export default async function CollectionsIndexPage() {
  const [categories, counts] = await Promise.all([
    getCategories(),
    prisma.product.groupBy({ by: ["category"], _count: { _all: true } }).catch(() => []),
  ]);
  const countBySlug = new Map(counts.map((c) => [c.category, c._count._all]));
  const visible = categories.filter((c) => (countBySlug.get(c.slug) ?? 0) > 0);

  return (
    <main className="min-h-[70vh]">
      <section className="bg-[#f8f1ee] px-5 py-11 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="luxury-eyebrow">Revendeur officiel CHOGAN (Italie)</p>
          <h1 className="mt-3 font-serif-display text-3xl font-medium text-navy sm:text-5xl">Toute la gamme</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-navy/60">
            Parfums, beauté, bien-être, nutrition et maison : retrouvez l&apos;ensemble des produits Chogan, disponibles au Sénégal avec JAMAAL.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/collections/${c.slug}`}
                className="group block h-full rounded-2xl border border-line bg-white p-6 transition hover:border-rose hover:shadow-lg hover:shadow-navy/5"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-rose-dark">{countBySlug.get(c.slug)} produits</p>
                <h2 className="mt-2 font-serif-display text-xl text-navy">{c.label}</h2>
                <p className="mt-2 text-sm leading-6 text-navy/60">{c.description}</p>
                <span className="mt-4 inline-block text-xs font-semibold text-navy group-hover:text-rose-dark">Découvrir →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
