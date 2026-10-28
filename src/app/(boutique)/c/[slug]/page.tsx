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
  CreditCard,
  Award,
  ChevronRight,
  ShoppingBag,
  Clock,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
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
  if (!shop) return { title: "Boutique Officielle JAMAAL" };
  const first = shop.consultant.name.split(/\s+/)[0];
  const description =
    shop.consultant.bio ||
    shop.consultant.tagline ||
    `Boutique officielle de ${first}, conseiller·e agréé·e JAMAAL à ${shop.consultant.city}. Haute Parfumerie Chogan 30% d'essence, commande directe WhatsApp et livraison à domicile partout au Sénégal.`;
  return {
    title: `Boutique Officielle de ${first} · JAMAAL Luxury Cosmetics`,
    description,
    openGraph: {
      title: `Boutique de ${first} · JAMAAL Haute Parfumerie`,
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
 * Boutique personnelle du conseiller — Véritable site web de marque de luxe :
 * - Announcement Bar supérieure
 * - Header e-commerce avec logo officiel JAMAAL, menu de navigation et contact
 * - Hero grand format immersif avec portrait officiel, titre, ville et notes clients
 * - Bandeau de réassurance 4 piliers « Les Attentions JAMAAL »
 * - Raccourcis univers & services (Quiz Parfum ADN, Routine Beauté, Collections)
 * - Vitrine e-commerce haute définition (badges 30% d'essence, prix FCFA, commande directe)
 * - Guide de commande en 3 étapes simples
 * - Témoignages & avis vérifiés
 * - Footer complet de haute parfumerie
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
    `Bonjour ${first}, je visite votre boutique officielle JAMAAL (${origin}/c/${c.slug}) : j'aimerais des conseils parfumés et passer commande 🌸`
  );
  const waProduct = (name: string) =>
    shopWhatsAppLink(
      c.whatsapp,
      `Bonjour ${first}, je souhaite commander ${name} (vu sur votre boutique JAMAAL). Est-il disponible pour livraison ?`
    );

  const shortcuts = [
    { href: `/parfum-adn${ref}`, label: "Quiz Parfum ADN", desc: "Votre signature olfactive en 1 min", icon: Dna, badge: "Recommandé" },
    { href: `/collections${ref}`, label: "Tout le Catalogue", desc: "Extraits 15ml, 30ml, 70ml & Niche", icon: Search, badge: "Intégral" },
    { href: `/skin-advisor${ref}`, label: "Diagnostic Beauté", desc: "Soins & crèmes corps parfumées", icon: Sparkles, badge: "IA Beauté" },
    { href: `/carte-cadeau${ref}`, label: "Offrir un Coffret", desc: "Le cadeau prestigieux par excellence", icon: Gift, badge: "Cadeau" },
  ];

  return (
    <div className={`min-h-screen ${st.pageBg} selection:bg-amber-400 selection:text-black font-sans`}>

      {/* ── 1. TOP ANNOUNCEMENT BAR (STYLE GRAND SITE WEB) ───────────────── */}
      <aside aria-label="Annonces boutique" className={`border-b ${st.cardBorder} py-2 px-4 text-center text-[11px] tracking-widest uppercase font-medium ${st.cardBg}`}>
        <div className="mx-auto max-w-6xl flex items-center justify-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <Sparkles size={13} className={st.textAccent} />
            Haute Parfumerie Chogan Italie · 30% d&apos;Essence Pure
          </span>
          <span className="hidden sm:inline text-neutral-400">•</span>
          <span className="hidden sm:inline">
            Livraison Express à Domicile (Dakar &amp; Régions)
          </span>
          <span className="hidden md:inline text-neutral-400">•</span>
          <span className="hidden md:inline font-semibold">
            Boutique Agréée de {c.name}
          </span>
        </div>
      </aside>

      {/* ── 2. HEADER & NAVIGATION E-COMMERCE ───────────────────────────── */}
      <header className={`sticky top-0 z-50 border-b ${st.cardBorder} ${theme.isDark ? "bg-[#0b0c10]/85" : "bg-white/85"} backdrop-blur-lg transition-all`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          {/* Logo & Identité Revendeur */}
          <div className="flex items-center gap-3">
            <Link href={`/${ref}`} className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/jamaal-logo.jpg"
                alt="JAMAAL Luxury Cosmetics"
                className={`h-10 w-auto rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105 ${st.logoInvert ? "brightness-95 contrast-125" : ""}`}
              />
            </Link>
            <div className="hidden sm:block border-l border-neutral-300/40 pl-3">
              <span className={`block font-serif-display text-sm font-bold tracking-wide ${st.textPrimary}`}>
                {c.name}
              </span>
              <span className={`block text-[10px] uppercase tracking-wider ${st.textMuted}`}>
                Conseiller·e Agréé·e · {c.city}
              </span>
            </div>
          </div>

          {/* Navigation centrale de vrai site web */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold tracking-wider uppercase">
            <a href="#produits" className={`${st.textSecondary} hover:${st.textAccent} transition`}>
              Nos Parfums
            </a>
            <a href="#services" className={`${st.textSecondary} hover:${st.textAccent} transition`}>
              Expérience
            </a>
            <a href="#attentions" className={`${st.textSecondary} hover:${st.textAccent} transition`}>
              Garanties
            </a>
            <a href="#avis" className={`${st.textSecondary} hover:${st.textAccent} transition`}>
              Avis Clients
            </a>
            <Link href={`/collections${ref}`} className={`${st.textAccent} hover:underline font-bold`}>
              Catalogue ↗
            </Link>
          </nav>

          {/* Boutons d'action rapides */}
          <div className="flex items-center gap-2.5">
            <Link
              href={`/panier${ref}`}
              aria-label="Mon panier"
              className={`p-2 rounded-full border ${st.cardBorder} ${st.cardBg} ${st.textPrimary} hover:scale-105 transition`}
            >
              <ShoppingBag size={17} />
            </Link>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all shadow-md ${st.waButton}`}
              >
                <Phone size={14} />
                <span className="hidden sm:inline">Commander sur WhatsApp</span>
                <span className="sm:hidden">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── 3. HERO BANNER E-COMMERCE IMMERSIF (GRAND FORMAT) ──────────── */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className={`absolute inset-0 ${st.heroOverlay} pointer-events-none`} aria-hidden="true" />

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20 relative z-10">
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:text-left md:gap-12 lg:gap-16">

            {/* Portrait officiel avec cadre d'orfèvrerie */}
            <div className="shrink-0 relative">
              <div
                className={`relative h-44 w-44 overflow-hidden rounded-3xl border-4 shadow-2xl sm:h-52 sm:w-52 lg:h-60 lg:w-60 ${st.avatarBorder} ${st.avatarRing}`}
              >
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-serif-display text-6xl text-white">
                    {initials(c.name)}
                  </span>
                )}
                <div className="absolute bottom-2 right-2 rounded-full bg-emerald-500 p-1.5 text-white shadow-lg border-2 border-white">
                  <CheckCircle2 size={16} />
                </div>
              </div>

              {/* Badges de réputation */}
              <div className="mt-4 flex justify-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold shadow-sm ${st.badgeStyle}`}>
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  {stats.rating ? stats.rating.toFixed(1) : "5.0"}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold shadow-sm ${st.badgeStyle}`}>
                  {stats.clients >= 5 ? `${stats.clients}+ clients` : "Conseil Privé"}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold shadow-sm ${st.badgeStyle}`}>
                  🇸🇳 {c.city}
                </span>
              </div>
            </div>

            {/* Texte et présentation de prestige */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold tracking-wider uppercase mb-3 border shadow-sm backdrop-blur-md" style={{ borderColor: theme.palette.accent }}>
                <Award size={13} className="text-amber-400" />
                <span>Boutique Officielle · {c.title} JAMAAL</span>
              </div>

              <h1 className={`font-serif-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl ${st.textPrimary} leading-tight`}>
                {c.name}
              </h1>

              {c.tagline ? (
                <p className={`mt-3 font-serif-display text-lg italic sm:text-xl lg:text-2xl ${st.textAccent}`}>
                  « {c.tagline} »
                </p>
              ) : (
                <p className={`mt-3 font-serif-display text-lg italic sm:text-xl ${st.textAccent}`}>
                  « L&apos;art du parfum d&apos;exception à prix juste. »
                </p>
              )}

              <p className={`mt-4 max-w-xl text-sm leading-relaxed sm:text-base ${st.textSecondary}`}>
                {c.bio ||
                  `Bienvenue dans mon espace exclusif ! Conseiller·e officiel·le de la Maison JAMAAL, je sélectionne pour vous les plus grands extraits de parfum Chogan (30% d'essence pure). Conseils sur-mesure et livraison soignée à domicile.`}
              </p>

              {/* Boutons d'appel à l'action */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-sm font-bold shadow-lg transition-all ${st.waButton}`}
                  >
                    <MessageCircle size={19} />
                    <span>Échanger avec {first} sur WhatsApp</span>
                  </a>
                )}
                <a
                  href="#produits"
                  className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold transition-all ${st.buttonSecondary}`}
                >
                  <Search size={16} /> Explorer les parfums
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. BANDEAU « LES ATTENTIONS JAMAAL » (4 PILIERS DU SITE WEB) ──── */}
      <section id="attentions" aria-label="Les attentions JAMAAL" className={`border-b ${st.cardBorder} ${st.guaranteeBannerBg} py-8 px-4`}>
        <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl mb-1 shadow-inner">
              <Sparkles size={22} className="text-amber-400" />
            </span>
            <p className={`font-serif-display font-bold text-sm ${st.guaranteeBannerText}`}>30% d&apos;Essence Pure</p>
            <p className={`text-xs opacity-75 max-w-[180px] ${st.guaranteeBannerText}`}>Extraits de parfum certifiés Chogan, tenue supérieure à 12h</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl mb-1 shadow-inner">
              <ShieldCheck size={22} className="text-emerald-400" />
            </span>
            <p className={`font-serif-display font-bold text-sm ${st.guaranteeBannerText}`}>Conseil Sur-Mesure</p>
            <p className={`text-xs opacity-75 max-w-[180px] ${st.guaranteeBannerText}`}>Accompagnement personnalisé par {first} pour trouver votre sillage</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl mb-1 shadow-inner">
              <Truck size={22} className="text-sky-400" />
            </span>
            <p className={`font-serif-display font-bold text-sm ${st.guaranteeBannerText}`}>Livraison Express</p>
            <p className={`text-xs opacity-75 max-w-[180px] ${st.guaranteeBannerText}`}>Partout à Dakar sous 24h et expéditions rapides en régions</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl mb-1 shadow-inner">
              <CreditCard size={22} className="text-amber-300" />
            </span>
            <p className={`font-serif-display font-bold text-sm ${st.guaranteeBannerText}`}>Paiement sécurisé</p>
            <p className={`text-xs opacity-75 max-w-[180px] ${st.guaranteeBannerText}`}>Réglez par Wave, Orange Money ou avec votre wallet JAMAAL</p>
          </div>
        </div>
      </section>

      {/* ── 5. SERVICES & EXPÉRIENCE DE MARQUE ──────────────────────────── */}
      <section id="services" aria-label="Services exclusifs" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${st.textAccent}`}>Expérience Olfactive</p>
            <h2 className={`font-serif-display text-2xl font-bold sm:text-3xl ${st.textPrimary} mt-1`}>
              Découvrir nos univers
            </h2>
          </div>
          <Link href={`/collections${ref}`} className={`text-xs font-bold ${st.textAccent} hover:underline flex items-center gap-1`}>
            <span>Catalogue complet</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group relative flex flex-col justify-between p-5 rounded-3xl transition-all duration-300 ${st.cardBg} ${st.cardHover} ${st.shortcutHover}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-md ${st.badgeStyle}`}>
                    <s.icon size={20} className={st.textAccent} />
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-500 border border-amber-400/20">
                    {s.badge}
                  </span>
                </div>
                <h3 className={`font-serif-display font-bold text-base ${st.textPrimary}`}>
                  {s.label}
                </h3>
                <p className={`mt-1 text-xs leading-relaxed ${st.textMuted}`}>
                  {s.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200/20 flex items-center justify-between text-xs font-semibold">
                <span className={st.textAccent}>Explorer</span>
                <ChevronRight size={15} className={`transition-transform duration-200 group-hover:translate-x-1 ${st.textAccent}`} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 6. VITRINE PRODUITS E-COMMERCE (GRANDE GRILLE) ───────────────── */}
      <section id="produits" aria-label="Vitrine parfums" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-500 border border-amber-400/20 mb-2">
              <Sparkles size={12} /> Sélection Privée
            </div>
            <h2 className={`font-serif-display text-3xl font-bold sm:text-4xl ${st.textPrimary}`}>
              {shop.chosen ? `Les Coups de Cœur de ${first}` : "Les Meilleures Ventes du Moment"}
            </h2>
            <p className={`mt-1 text-xs sm:text-sm ${st.textSecondary}`}>
              Flacons scellés en direct de Chogan Italie · Prix officiels JAMAAL en Francs CFA
            </p>
          </div>

          <Link
            href={`/collections${ref}`}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${st.buttonSecondary}`}
          >
            <Search size={14} /> Voir les 120+ fragrances
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-6">
            {products.map((p) => {
              const ask = waProduct(p.name);
              return (
                <article
                  key={p.id}
                  className={`group flex flex-col overflow-hidden rounded-3xl transition-all duration-300 ${st.productCardBg} ${st.productCardHover}`}
                >
                  {/* Photo produit avec badge et zoom doux */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                    <Link href={`/produits/${p.slug}${ref}`} className="block h-full w-full">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-400">
                          <Sparkles size={40} />
                        </div>
                      )}
                    </Link>

                    {/* Badge 30% d'essence */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[9px] font-bold text-amber-300 uppercase tracking-widest border border-amber-400/30">
                        Extrait 30%
                      </span>
                    </div>
                  </div>

                  {/* Détails du parfum */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${st.textMuted}`}>
                      Haute Parfumerie
                    </p>
                    <Link
                      href={`/produits/${p.slug}${ref}`}
                      className={`mt-1 font-serif-display text-base font-bold line-clamp-1 group-hover:${st.textAccent} transition-colors ${st.textPrimary}`}
                    >
                      {p.name}
                    </Link>

                    {p.inspiredBy && (
                      <p className={`mt-0.5 line-clamp-1 text-xs italic ${st.textAccent}`}>
                        Inspiré de {p.inspiredBy}
                      </p>
                    )}

                    {/* Prix officiel JAMAAL */}
                    <div className="mt-3 pt-3 border-t border-neutral-200/20 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Tarif JAMAAL</span>
                        <span className={`text-base font-bold font-mono ${st.priceStyle}`}>
                          {p.price ? priceLabel(p.price, p.multiFormat).replace(/^à/, "À") : "Consulter"}
                        </span>
                      </div>
                    </div>

                    {/* Actions : Commander & WhatsApp direct */}
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/produits/${p.slug}${ref}`}
                        className={`flex-1 rounded-2xl py-2.5 text-center text-xs font-bold transition-all shadow-sm ${st.buttonPrimary}`}
                      >
                        Commander
                      </Link>
                      {ask && (
                        <a
                          href={ask}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Commander ${p.name} sur WhatsApp`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-md hover:bg-[#20ba59] transition"
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-10 text-sm text-neutral-500">Aucun produit mis en avant pour le moment.</p>
        )}

        <div className="mt-10 text-center">
          <Link
            href={`/collections${ref}`}
            className={`inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold shadow-lg transition-all ${st.buttonSecondary}`}
          >
            <Search size={16} />
            <span>Explorer l&apos;intégralité du catalogue JAMAAL</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── 7. SECTION « COMMENT COMMANDER EN 3 ÉTAPES » ────────────────── */}
      <section aria-label="Comment commander" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className={`rounded-3xl border ${st.cardBorder} ${st.cardBg} p-8 sm:p-12 shadow-xl`}>
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${st.textAccent}`}>Processus Fluide</span>
            <h2 className={`font-serif-display text-2xl sm:text-3xl font-bold ${st.textPrimary} mt-1`}>
              Commander en toute sérénité
            </h2>
            <p className={`mt-2 text-xs sm:text-sm ${st.textSecondary}`}>
              Un service sur-mesure digne des plus grandes maisons de luxe, orchestré par {first}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <span className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-bold mb-4 shadow-md ${st.badgeStyle}`}>
                1
              </span>
              <h3 className={`font-serif-display font-bold text-base ${st.textPrimary}`}>Choisissez votre Fragrance</h3>
              <p className={`mt-2 text-xs leading-relaxed ${st.textMuted}`}>
                Parcourez les coups de cœur ci-dessus ou testez notre Quiz Parfum ADN pour révéler votre signature olfactive.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <span className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-bold mb-4 shadow-md ${st.badgeStyle}`}>
                2
              </span>
              <h3 className={`font-serif-display font-bold text-base ${st.textPrimary}`}>Échangez avec {first}</h3>
              <p className={`mt-2 text-xs leading-relaxed ${st.textMuted}`}>
                Cliquez sur WhatsApp pour valider la disponibilité immédiate du flacon et convenir de votre adresse de livraison.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <span className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-bold mb-4 shadow-md ${st.badgeStyle}`}>
                3
              </span>
              <h3 className={`font-serif-display font-bold text-base ${st.textPrimary}`}>Livraison &amp; Paiement Sûr</h3>
              <p className={`mt-2 text-xs leading-relaxed ${st.textMuted}`}>
                Recevez votre coffret scellé chez vous ou à votre bureau sous 24h, et payez directement par Wave, OM ou espèces.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. TÉMOIGNAGES CLIENTS VÉRIFIÉS ──────────────────────────────── */}
      {reviews.length > 0 && (
        <section id="avis" aria-label="Avis clients" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="text-center max-w-lg mx-auto mb-8">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${st.textAccent}`}>Témoignages Vérifiés</span>
            <h2 className={`font-serif-display text-2xl sm:text-3xl font-bold ${st.textPrimary} mt-1`}>
              Ce que disent nos clients
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div
                key={r.id}
                className={`rounded-3xl p-6 transition-all duration-300 ${st.cardBg} ${st.cardHover}`}
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < r.rating ? "text-amber-400 fill-amber-400" : "text-neutral-300"}
                    />
                  ))}
                </div>
                <p className={`text-xs sm:text-sm leading-relaxed italic ${st.textSecondary}`}>
                  « {r.comment} »
                </p>
                <div className="mt-5 pt-4 border-t border-neutral-200/20 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: theme.palette.accent }}
                  >
                    {r.author[0]?.toUpperCase()}
                  </span>
                  <div>
                    <p className={`text-xs font-bold ${st.textPrimary}`}>{r.author}</p>
                    <p className={`text-[10px] ${st.textMuted}`}>{r.product}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 9. FOOTER E-COMMERCE COMPLET DE HAUTE PARFUMERIE ─────────────── */}
      <footer className={`mt-16 border-t ${st.cardBorder} ${theme.isDark ? "bg-[#07080a]" : "bg-neutral-50"}`}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-200/20">
            {/* Col 1 : Marque & Logo */}
            <div className="md:col-span-2">
              <Link href={`/${ref}`} className="inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo/jamaal-logo.jpg"
                  alt="JAMAAL Luxury Cosmetics"
                  className={`h-11 w-auto rounded-xl ${st.logoInvert ? "brightness-95 contrast-125" : ""}`}
                />
              </Link>
              <p className={`mt-3 text-xs leading-relaxed max-w-sm ${st.textMuted}`}>
                JAMAAL Luxury Cosmetics est le distributeur d&apos;excellence des parfums et cosmétiques Chogan au Sénégal. Extraits purs à 30% d&apos;essence, créés avec passion en Italie.
              </p>
            </div>

            {/* Col 2 : Votre Conseiller */}
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${st.textPrimary} mb-3`}>
                Votre Conseiller·e
              </p>
              <ul className={`space-y-1.5 text-xs ${st.textMuted}`}>
                <li className="font-semibold text-neutral-800 dark:text-neutral-200">{c.name}</li>
                <li>Secteur : {c.city} &amp; Tout le Sénégal</li>
                {c.whatsapp && <li>WhatsApp : {c.whatsapp}</li>}
                <li>Statut : Conseiller·e Agréé·e</li>
              </ul>
            </div>

            {/* Col 3 : Accès Rapides */}
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${st.textPrimary} mb-3`}>
                Univers JAMAAL
              </p>
              <ul className={`space-y-1.5 text-xs ${st.textMuted}`}>
                <li><Link href={`/collections${ref}`} className="hover:underline">Catalogue Parfums</Link></li>
                <li><Link href={`/parfum-adn${ref}`} className="hover:underline">Quiz Parfum ADN</Link></li>
                <li><Link href={`/carte-cadeau${ref}`} className="hover:underline">Cartes Cadeaux</Link></li>
                <li><Link href={`/mentions-legales${ref}`} className="hover:underline">Mentions Légales</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 gap-3">
            <p>© {new Date().getFullYear()} JAMAAL Luxury Cosmetics · Boutique Personnelle de {c.name}</p>
            <p className="font-serif-display italic">« Un parfum ne se porte pas, il se vit. »</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
