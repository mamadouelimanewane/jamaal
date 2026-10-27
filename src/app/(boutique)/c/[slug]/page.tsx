import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Gift,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Dna,
  Phone,
  Award,
  ChevronRight,
} from "lucide-react";
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
 * Boutique personnelle du consultant — landing page de marque personnelle responsive :
 * navbar, hero cinématique, services/raccourcis, vitrine produits, témoignages, footer réassurance.
 * Thème personnalisé par le revendeur. Toutes les commandes lui sont attribuées via cookie + ?ref=.
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
    { href: `/parfum-adn${ref}`, label: "Trouver mon parfum en 1 minute", desc: "Quiz olfactif personnalisé", icon: Dna },
    { href: `/collections${ref}`, label: "Toute la boutique", desc: "Catalogue complet Chogan", icon: Search },
    { href: `/skin-advisor${ref}`, label: "Ma routine de soins", desc: "Conseil beauté en un selfie", icon: Sparkles },
    { href: `/carte-cadeau${ref}`, label: "Offrir une carte cadeau", desc: "L'idée cadeau parfaite", icon: Gift },
  ];

  return (
    <div className={`min-h-screen ${st.pageBg}`}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 border-b ${st.cardBorder} ${theme.isDark ? "bg-[rgba(8,8,10,0.85)]" : "bg-white/85"} backdrop-blur-md`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo JAMAAL */}
          <Link href={`/${ref}`} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/jamaal-logo.jpg"
              alt="JAMAAL"
              className={`h-9 w-auto rounded-lg ${st.logoInvert ? "brightness-90 contrast-125" : ""}`}
            />
          </Link>

          {/* Nom du revendeur centré */}
          <p className={`hidden sm:block font-serif-display text-sm font-semibold tracking-wide ${st.textPrimary}`}>
            Boutique de {c.name}
          </p>

          {/* CTA WhatsApp */}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${st.waButton}`}
            >
              <Phone size={15} />
              <span className="hidden sm:inline">WhatsApp</span>
              <span className="sm:hidden">Contact</span>
            </a>
          )}
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Overlay dégradé hero */}
        <div className={`absolute inset-0 ${st.heroOverlay} pointer-events-none`} aria-hidden="true" />

        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:text-left sm:gap-12">

            {/* Photo du consultant — grande */}
            <div className="shrink-0">
              <div
                className={`relative h-36 w-36 overflow-hidden rounded-2xl border-4 shadow-2xl sm:h-44 sm:w-44 lg:h-52 lg:w-52 ${st.avatarBorder} ${st.avatarRing}`}
              >
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <span className={`flex h-full w-full items-center justify-center font-serif-display text-5xl text-white`}>
                    {initials(c.name)}
                  </span>
                )}
              </div>
              {/* Stats compactes sous la photo */}
              {(stats.clients >= 3 || stats.rating) && (
                <div className={`mt-3 flex justify-center gap-3 sm:justify-start`}>
                  {stats.clients >= 3 && (
                    <div className={`rounded-xl px-3 py-1.5 text-center ${st.badgeStyle}`}>
                      <p className={`text-base font-bold ${st.textPrimary}`}>{stats.clients}+</p>
                      <p className={`text-[10px] ${st.textMuted}`}>clients</p>
                    </div>
                  )}
                  {stats.rating && (
                    <div className={`rounded-xl px-3 py-1.5 text-center ${st.badgeStyle}`}>
                      <p className={`text-base font-bold ${st.textPrimary}`}>{stats.rating.toFixed(1).replace(".", ",")}</p>
                      <p className={`text-[10px] ${st.textMuted}`}>/ 5 ⭐</p>
                    </div>
                  )}
                  <div className={`rounded-xl px-3 py-1.5 text-center ${st.badgeStyle}`}>
                    <p className={`text-base font-bold ${st.textPrimary}`}>🚚</p>
                    <p className={`text-[10px] ${st.textMuted}`}>livraison</p>
                  </div>
                </div>
              )}
            </div>

            {/* Texte hero */}
            <div className="flex-1 min-w-0">
              {/* Badge titre */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${st.badgeStyle}`}>
                <Award size={12} />
                {c.title} JAMAAL · <MapPin size={11} className="inline" /> {c.city}
              </span>

              <h1 className={`mt-3 font-serif-display text-3xl font-bold tracking-wide sm:text-4xl lg:text-5xl ${st.textPrimary}`}>
                {c.name}
              </h1>

              {c.tagline && (
                <p className={`mt-2 font-serif-display text-base italic sm:text-lg ${st.textAccent}`}>
                  « {c.tagline} »
                </p>
              )}

              <p className={`mt-4 max-w-lg text-sm leading-relaxed sm:text-base ${st.textSecondary}`}>
                {c.bio ||
                  `Bienvenue dans ma boutique ! Je vous conseille parfums et soins Chogan et je m'occupe de votre commande jusqu'à la livraison. 🌸`}
              </p>

              {/* Badges certifications */}
              {shop.badges.length > 0 && (
                <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {shop.badges.map((b) => (
                    <li key={b.id}>
                      <details className="group">
                        <summary
                          className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${st.badgeStyle}`}
                          style={{ borderColor: b.color }}
                        >
                          <span aria-hidden="true">{b.emoji}</span> {b.label} <span aria-hidden="true">✓</span>
                        </summary>
                        <p className={`mt-2 max-w-xs rounded-xl p-3 text-xs shadow ${st.cardBg}`}>
                          {b.promise}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA hero */}
              {wa && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-start">
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold ${st.waButton}`}
                  >
                    <MessageCircle size={20} /> Me contacter sur WhatsApp
                  </a>
                  <a
                    href={`/collections${ref}`}
                    className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold ${st.buttonSecondary}`}
                  >
                    <Search size={18} /> Voir le catalogue
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SEPARATEUR DECORATIF ───────────────────────────────────────── */}
      <div className={`border-t ${st.dividerStyle}`} />

      {/* ── CONTENU PRINCIPAL ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">

        {/* ── RACCOURCIS / SERVICES ──────────────────────────────────── */}
        <section aria-label="Services & raccourcis">
          <h2 className={`font-serif-display text-xl font-semibold sm:text-2xl ${st.textPrimary}`}>
            Mes services
          </h2>
          <div className={`mt-1 mb-5 h-0.5 w-14 ${st.dividerStyle}`} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`group flex items-start gap-3 rounded-2xl px-4 py-4 transition-all ${st.cardBg} ${st.cardHover} ${st.shortcutHover}`}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${st.badgeStyle}`}>
                  <s.icon size={18} className="text-amber-500" />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${st.textPrimary}`}>{s.label}</p>
                  <p className={`mt-0.5 text-[11px] ${st.textMuted}`}>{s.desc}</p>
                </div>
                <ChevronRight size={14} className={`ml-auto mt-1 shrink-0 opacity-40 group-hover:opacity-80 ${st.textMuted}`} />
              </Link>
            ))}
          </div>
        </section>

        {/* ── VITRINE PRODUITS ───────────────────────────────────────── */}
        {products.length > 0 && (
          <section className="mt-14" aria-label="Coups de cœur">
            <div className="flex items-end justify-between">
              <div>
                <h2 className={`font-serif-display text-xl font-semibold sm:text-2xl ${st.textPrimary}`}>
                  {shop.chosen ? `Les coups de cœur de ${first}` : "Les préférés de mes clients"}
                </h2>
                <div className={`mt-1 h-0.5 w-14 ${st.dividerStyle}`} />
              </div>
              <Link
                href={`/collections${ref}`}
                className={`text-xs font-semibold ${st.textAccent} hover:underline`}
              >
                Voir tout →
              </Link>
            </div>

            {/* Grille produits : 2 col mobile, 3 col tablette, 4 col desktop */}
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const ask = waProduct(p.name);
                return (
                  <li
                    key={p.id}
                    className={`group flex flex-col overflow-hidden rounded-2xl transition-all duration-200 ${st.productCardBg} ${st.productCardHover}`}
                  >
                    {/* Photo produit */}
                    <Link href={`/produits/${p.slug}${ref}`} className="block aspect-[4/5] overflow-hidden">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className={`flex h-full items-center justify-center ${st.textMuted}`}>
                          <Sparkles size={36} />
                        </span>
                      )}
                    </Link>

                    {/* Infos produit */}
                    <div className="flex flex-1 flex-col p-3">
                      <Link
                        href={`/produits/${p.slug}${ref}`}
                        className={`line-clamp-2 text-sm font-semibold leading-snug ${st.textPrimary}`}
                      >
                        {p.name}
                      </Link>
                      {p.inspiredBy && (
                        <p className={`mt-0.5 line-clamp-1 text-[11px] italic ${st.textAccent}`}>
                          Inspiré de {p.inspiredBy}
                        </p>
                      )}
                      {p.price ? (
                        <p className={`mt-1.5 text-sm ${st.priceStyle}`}>
                          {priceLabel(p.price, p.multiFormat).replace(/^à/, "À")}
                        </p>
                      ) : null}

                      {/* Boutons action */}
                      <div className="mt-auto flex gap-1.5 pt-2.5">
                        <Link
                          href={`/produits/${p.slug}${ref}`}
                          className={`flex-1 rounded-full px-2 py-2 text-center text-xs font-semibold transition-all ${st.buttonPrimary}`}
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

            {/* CTA voir tout */}
            <div className="mt-6 text-center">
              <a
                href={`/collections${ref}`}
                className={`inline-flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-semibold transition-all ${st.buttonSecondary}`}
              >
                <Search size={16} /> Explorer tout le catalogue
              </a>
            </div>
          </section>
        )}

        {/* ── TEMOIGNAGES CLIENTS ────────────────────────────────────── */}
        {reviews.length > 0 && (
          <section className="mt-16" aria-label="Témoignages clients">
            <h2 className={`font-serif-display text-xl font-semibold sm:text-2xl ${st.textPrimary}`}>
              {reviews.some((r) => r.mine) ? "Ce que disent mes clients" : "Ce que disent les clients JAMAAL"}
            </h2>
            <div className={`mt-1 mb-5 h-0.5 w-14 ${st.dividerStyle}`} />

            {/* Grille avis : scroll horizontal mobile, grille desktop */}
            <div className="-mx-4 sm:mx-0">
              <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className={`w-72 shrink-0 snap-start rounded-2xl p-5 transition-all duration-200 sm:w-auto ${st.cardBg} ${st.cardHover}`}
                  >
                    <p className={`flex gap-0.5 ${st.starColor}`} aria-label={`${r.rating} sur 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={15} fill={i < r.rating ? "currentColor" : "none"} />
                      ))}
                    </p>
                    <p className={`mt-3 text-sm leading-relaxed ${st.textSecondary}`}>
                      « {r.comment} »
                    </p>
                    <div className={`mt-4 flex items-center gap-2 border-t pt-3 ${st.dividerStyle}`}>
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
                        style={{ backgroundColor: theme.palette.accent }}
                      >
                        {r.author[0]?.toUpperCase()}
                      </span>
                      <div>
                        <p className={`text-xs font-semibold ${st.textPrimary}`}>{r.author.split(/\s+/)[0]}</p>
                        <p className={`text-[10px] ${st.textMuted}`}>{r.product}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── BANDEAU REASSURANCE ────────────────────────────────────── */}
        <section className={`mt-16 overflow-hidden rounded-3xl shadow-lg ${st.guaranteeBannerBg}`}>
          <div className="grid gap-0 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Produits officiels", desc: "100 % Chogan Italie, certifiés et authentiques" },
              { icon: Truck, title: "Livraison à domicile", desc: "Partout au Sénégal, suivi personnalisé par " + first },
              { icon: Phone, title: "Paiement flexible", desc: "Wave, Orange Money, ou à la livraison" },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-2 px-6 py-7 text-center ${i > 0 ? `border-t sm:border-t-0 sm:border-l ${st.dividerStyle}` : ""}`}
              >
                <item.icon size={26} className={st.guaranteeBannerText} />
                <p className={`font-serif-display text-sm font-semibold ${st.guaranteeBannerText}`}>{item.title}</p>
                <p className={`text-xs ${st.guaranteeBannerText} opacity-75`}>{item.desc}</p>
              </div>
            ))}
          </div>

          {wa && (
            <div className={`border-t px-6 py-5 text-center ${st.dividerStyle}`}>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${st.buttonSecondary}`}
              >
                <MessageCircle size={16} /> Écrire à {first}
              </a>
            </div>
          )}
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className={`border-t ${st.cardBorder}`}>
        <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6`}>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className={`text-xs ${st.textMuted}`}>
                Boutique officielle de{" "}
                <span className={`font-semibold ${st.textPrimary}`}>{c.name}</span>
                {" "}· Conseiller·e JAMAAL
              </p>
              <p className={`mt-0.5 text-xs ${st.textMuted}`}>
                Vos commandes sont suivies personnellement par {first}.
              </p>
            </div>
            <Link href={`/${ref}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/jamaal-logo.jpg"
                alt="JAMAAL Luxury Cosmetics"
                className={`h-10 w-auto rounded-lg opacity-80 hover:opacity-100 transition ${st.logoInvert ? "brightness-90 contrast-125" : ""}`}
              />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
