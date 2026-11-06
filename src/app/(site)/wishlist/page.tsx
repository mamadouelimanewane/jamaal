"use client";

import { useT } from "@/components/i18n/LocaleProvider";
import Link from "@/components/i18n/Link";
import { useWishlistStore } from "@/lib/wishlist-store";

/**
 * Destination : src/app/(site)/wishlist/page.tsx
 * Route : /wishlist
 */
export default function WishlistPage() {
  const t = useT();
  const { items, remove, clear } = useWishlistStore();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">{t("Mes favoris")}</h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-rose-dark hover:underline"
          >
            {t("Tout vider")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-navy/60">{t("Aucun produit dans vos favoris pour le moment.")}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-rose-dark">
            {t("Découvrir les parfums →")}
          </Link>
          <Link href="/parfum-adn" className="mt-2 block text-sm text-navy/50 hover:underline">
            {t("Ou faire le quiz signature")}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4"
            >
              <div
                className="h-14 w-14 shrink-0 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${item.colorFrom}, ${item.colorTo})`,
                }}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/produits/${item.slug}`}
                  className="text-sm font-semibold text-navy hover:underline"
                >
                  {item.name}
                </Link>
                <p className="text-xs text-navy/50">{item.priceLabel}</p>
              </div>
              <Link
                href={`/produits/${item.slug}`}
                className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white"
              >
                {t("Voir")}
              </Link>
              <button
                type="button"
                onClick={() => remove(item.productId)}
                className="text-xs font-semibold text-rose-dark"
              >
                {t("Retirer")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
