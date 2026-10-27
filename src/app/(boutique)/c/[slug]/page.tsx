import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Gift, MapPin, MessageCircle, Search, ShieldCheck, Sparkles, Star, Truck, Dna } from "lucide-react";
import { getConsultantShop, shopWhatsAppLink } from "@/lib/shop/consultant-shop";
import { priceLabel } from "@/lib/share-text";
import { getSiteUrl } from "@/lib/site-url";
import { getShopTheme } from "@/lib/shop/themes";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getConsultantShop(slug).catch(() => null);
  if (!shop) return { title: "Boutique JAMAAL" };
  const first = shop.consultant.name.split(/\s+/)[0];
  const description =
    shop.consultant.bio ||
    shop.consultant.tagline ||
    `Parfums et soins Chogan avec ${first}, votre conseiller·e JAMAAL à ${shop.consultant.city}. Commande sur WhatsApp, livraison à domicile.`;
  return {
    title: `La boutique de ${first}`,
    description,
    openGraph: {
      title: `La boutique de ${first} · JAMAAL`,
      description,
      images: shop.consultant.photo
        ? [shop.consultant.photo]
        : shop.products[0]?.photo
        ? [shop.products[0].photo]
        : undefined,
    },
  };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * Boutique personnelle du consultant, pensée pour la bio Instagram et TikTok (« Linktree JAMAAL ») : photo,
 * présentation, thème personnalisé parmi la bibliothèque de thèmes, bouton WhatsApp, coups de cœur, avis clients
 * et raccourcis. Toutes les commandes passées depuis cette page lui sont attribuées (cookie posé par src/proxy.ts
 * sur /c/<slug>, et ?ref= sur chaque lien).
 */
export default async function ConsultantShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await getConsultantShop(slug);
  if (!shop) notFound();

  const { consultant: c, products, reviews, stats } = shop;
  const theme = getShopTheme(c.themeId);
  const st = theme.styles;

  const first = c.name.split(/\s+/)[0];
  const ref = `?ref=${c.slug}`;
  const origin = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  const wa = shopWhatsAppLink(
    c.whatsapp,
    `Bonjour ${first}, je viens de votre boutique JAMAAL ${origin}/c/${c.slug} : j'aimerais un conseil 🌸`
  );
  const waProduct = (name: string) =>
    shopWhatsAppLink(
      c.whatsapp,
      `Bonjour ${first}, je suis intéressé·e par ${name} (vu sur votre boutique JAMAAL). Il est disponible ?`
    );

  const shortcuts = [
    { href: `/parfum-adn${ref}`, label: "Trouver mon parfum en 1 minute", icon: Dna },
    { href: `/collections${ref}`, label: "Toute la boutique", icon: Search },
    { href: `/skin-advisor${ref}`, label: "Ma routine de soins en un selfie", icon: Sparkles },
    { href: `/carte-cadeau${ref}`, label: "Offrir une carte cadeau", icon: Gift },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${st.pageBg}`}>
      <div className="mx-auto max-w-md px-4 pb-16 pt-8">
        {/* En-tête : photo, nom, slogan, présentation */}
        <section className="text-center">
          {/* Overlay hero subtil */}
          <div className={`absolute inset-x-0 top-0 h-60 pointer-events-none ${st.heroOverlay}`} aria-hidden="true" />

          <div
            className={`relative mx-auto h-28 w-28 overflow-hidden rounded-full border-4 ${st.avatarBorder} ${st.avatarRing}`}
          >
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- photo du consultant
              <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-serif-display text-4xl text-white">
                {initials(c.name)}
              </span>
            )}
          </div>

          <h1 className={`mt-4 font-serif-display text-3xl font-semibold tracking-wide ${st.textPrimary}`}>
            {c.name}
          </h1>

          {c.tagline && (
            <p className={`mt-1 font-serif-display italic text-sm font-medium tracking-wide ${st.textAccent}`}>
              « {c.tagline} »
            </p>
          )}

          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.badgeStyle}`}>
              {c.title} JAMAAL
            </span>
            <span className={`flex items-center gap-1 text-xs ${st.textMuted}`}>
              <MapPin size={13} /> {c.city}
            </span>
          </p>

          <p className={`mx-auto mt-3 max-w-sm text-sm leading-relaxed ${st.textSecondary}`}>
            {c.bio || `Bienvenue dans ma boutique ! Je vous conseille parfums et soins Chogan et je m'occupe de votre commande jusqu'à la livraison. 🌸`}
          </p>

          {shop.badges.length > 0 && (
            <ul aria-label="Certifications de l'Académie JAMAAL" className="mt-3 flex flex-wrap justify-center gap-2">
              {shop.badges.map((b) => (
                <li key={b.id}>
                  <details className="group text-center">
                    <summary
                      className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${st.badgeStyle}`}
                      style={{ borderColor: b.color }}
                    >
                      <span aria-hidden="true">{b.emoji}</span> {b.label} <span aria-hidden="true">✓</span>
                    </summary>
                    <p className={`mx-auto mt-2 max-w-xs rounded-xl p-3 text-xs shadow ${st.cardBg}`}>
                      {b.promise}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <div className={`mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs ${st.textMuted}`}>
            {stats.clients >= 3 && <span>⭐ {stats.clients} clients servis</span>}
            {stats.rating && <span>{stats.rating.toFixed(1).replace(".", ",")} / 5 sur mes avis</span>}
            <span className="inline-flex items-center gap-1">
              <Truck size={13} /> Livraison à domicile
            </span>
          </div>
        </section>

        {/* Bouton principal WhatsApp */}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-6 flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-semibold ${st.waButton}`}
          >
            <MessageCircle size={20} /> Me contacter sur WhatsApp
          </a>
        )}

        {/* Raccourcis (« liens de bio ») */}
        <nav aria-label="Raccourcis" className="mt-4 grid gap-2.5">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${st.cardBg} ${st.shortcutHover}`}
            >
              <s.icon size={18} className="shrink-0 text-amber-500" />
              <span className={st.textPrimary}>{s.label}</span>
            </Link>
          ))}
        </nav>

        {/* Coups de cœur du revendeur */}
        {products.length > 0 && (
          <section className="mt-9">
            <h2 className={`font-serif-display text-xl font-semibold ${st.textPrimary}`}>
              {shop.chosen ? `Les coups de cœur de ${first}` : "Les préférés de mes clients"}
            </h2>
            <div className={`mt-1 mb-3 h-px w-12 border-t-2 ${st.dividerStyle}`} />
            <ul className="grid grid-cols-2 gap-3">
              {products.map((p) => {
                const ask = waProduct(p.name);
                return (
                  <li
                    key={p.id}
                    className={`flex flex-col overflow-hidden rounded-2xl transition-all duration-200 ${st.productCardBg} ${st.productCardHover}`}
                  >
                    <Link href={`/produits/${p.slug}${ref}`} className="block aspect-square">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- photos du catalogue
                        <img src={p.photo} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-navy/25">
                          <Sparkles size={32} />
                        </span>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col p-3">
                      <Link
                        href={`/produits/${p.slug}${ref}`}
                        className={`line-clamp-2 text-sm font-semibold leading-snug ${st.textPrimary}`}
                      >
                        {p.name}
                      </Link>
                      {p.inspiredBy && (
                        <p className={`line-clamp-1 text-[11px] italic ${st.textAccent}`}>
                          Inspiré de {p.inspiredBy}
                        </p>
                      )}
                      {p.price ? (
                        <p className={`mt-1 text-sm ${st.priceStyle}`}>
                          {priceLabel(p.price, p.multiFormat).replace(/^à/, "À")}
                        </p>
                      ) : null}
                      <div className="mt-auto flex gap-1.5 pt-2">
                        <Link
                          href={`/produits/${p.slug}${ref}`}
                          className={`flex-1 rounded-full px-2 py-2 text-center text-xs font-semibold ${st.buttonPrimary}`}
                        >
                          Commander
                        </Link>
                        {ask && (
                          <a
                            href={ask}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Demander ${p.name} sur WhatsApp`}
                            className="flex items-center justify-center rounded-full bg-[#25D366] px-2.5 text-white transition hover:bg-[#20ba59]"
                          >
                            <MessageCircle size={15} />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Avis clients */}
        {reviews.length > 0 && (
          <section className="mt-9">
            <h2 className={`font-serif-display text-xl font-semibold ${st.textPrimary}`}>
              {reviews.some((r) => r.mine) ? "Ce que disent mes clients" : "Ce que disent les clients JAMAAL"}
            </h2>
            <div className={`mt-1 mb-3 h-px w-12 border-t-2 ${st.dividerStyle}`} />
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className={`w-64 shrink-0 snap-start rounded-2xl p-4 ${st.cardBg}`}
                >
                  <p className={`flex gap-0.5 ${st.starColor}`} aria-label={`${r.rating} sur 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={14} fill={i < r.rating ? "currentColor" : "none"} />
                    ))}
                  </p>
                  <p className={`mt-2 line-clamp-5 text-sm ${st.textSecondary}`}>« {r.comment} »</p>
                  <p className={`mt-2 text-xs font-semibold ${st.textPrimary}`}>
                    {r.author.split(/\s+/)[0]}
                    <span className={`font-normal ${st.textMuted}`}> · {r.product}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Bandeau de réassurance officielle */}
        <section className={`mt-9 rounded-2xl p-5 text-center shadow-md ${st.guaranteeBannerBg}`}>
          <ShieldCheck className={`mx-auto ${st.guaranteeBannerText}`} size={24} />
          <p className={`mt-2 text-sm leading-relaxed ${st.guaranteeBannerText}`}>
            Produits officiels Chogan, distribués au Sénégal par JAMAAL. Paiement Wave, Orange Money ou à la livraison.
          </p>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${st.buttonSecondary}`}
            >
              <MessageCircle size={16} /> Écrire à {first}
            </a>
          )}
        </section>

        <p className={`mt-6 text-center text-xs ${st.textMuted}`}>
          Vos commandes passées depuis cette page sont suivies personnellement par {first}.
        </p>

        {/* Logo JAMAAL */}
        <Link href={`/${ref}`} className="mt-6 block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo du site */}
          <img
            src="/logo/jamaal-logo.jpg"
            alt="JAMAAL Luxury Cosmetics"
            className={`mx-auto h-14 w-auto rounded-xl transition ${st.logoInvert ? "brightness-95 contrast-125" : ""}`}
          />
        </Link>
      </div>
    </div>
  );
}
