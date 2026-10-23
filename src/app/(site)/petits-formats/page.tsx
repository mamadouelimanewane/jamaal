import Link from "next/link";
import { getSmallFormatPerfumes } from "@/lib/db-products";
import { ProductCard } from "@/components/ProductCard";
import { formatPrice } from "@/lib/currency";

export const metadata = {
  title: "Parfums en petit format",
  description: "Les parfums JAMAAL en 30 ml et en 15 ml recharge : le plus accessible pour trouver votre sillage avant de choisir le grand format.",
};

export const dynamic = "force-dynamic";

export default async function SmallFormatsPage() {
  const items = await getSmallFormatPerfumes();
  const cheapest = items[0]?.price;
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-dark">Pour commencer sans se ruiner</p>
      <h1 className="mt-3 font-serif-display text-3xl font-semibold text-navy sm:text-4xl">Parfums en petit format</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-navy/70">
        Le même parfum, en 30 ml ou en 15 ml recharge{cheapest ? `, à partir de ${formatPrice(cheapest)}` : ""}. Idéal pour essayer un sillage, l&apos;offrir ou garder un flacon dans son sac, avant de choisir le grand format.
      </p>
      <p className="mt-2 text-sm text-navy/70">
        Pas sûr de votre choix ? <Link href="/parfum-adn" className="font-semibold text-rose-dark underline">Trouvez votre sillage</Link> ou parcourez les <Link href="/coffrets-decouverte" className="font-semibold text-rose-dark underline">coffrets découverte</Link>.
      </p>
      {items.length ? (
        <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ product, label, price }) => (
            <div key={product.id}>
              <ProductCard product={product} />
              <p className="mt-2 text-center text-xs font-semibold text-navy">{label} · {formatPrice(price)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-9 rounded-2xl border border-line bg-white p-8 text-center text-sm text-navy/70">Les petits formats arrivent bientôt.</p>
      )}
    </div>
  );
}
