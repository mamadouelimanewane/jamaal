import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Dna, Gift, LayoutGrid, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import { getConsultantShop, shopWhatsAppLink } from "@/lib/shop/consultant-shop";
import { priceLabel } from "@/lib/share-text";
import { getSiteUrl } from "@/lib/site-url";
import { shopLook } from "@/lib/shop/themes";
import { ShopTracker } from "@/components/shop/ShopTracker";
import "./shop.css";

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
    `La boutique de ${first}, conseiller·e JAMAAL à ${shop.consultant.city} : conseil parfum, commande sur WhatsApp et livraison.`;
  return {
    title: `La boutique de ${first}`,
    description,
    openGraph: {
      title: `La boutique de ${first} · JAMAAL`,
      description,
      images: shop.consultant.photo ? [shop.consultant.photo] : shop.products[0]?.photo ? [shop.products[0].photo] : undefined,
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

const price = (p: { price: number | null; multiFormat: boolean }) =>
  p.price ? priceLabel(p.price, p.multiFormat).replace(/^à/, "À") : "Prix sur demande";

function WaIcon({ size = 18 }: { size?: number }) {
  return <MessageCircle size={size} strokeWidth={1.8} aria-hidden="true" />;
}

/**
 * Boutique personnelle du conseiller (lien de bio Instagram / TikTok), habillée par le thème qu'il a choisi
 * dans Ma boutique : 14 thèmes, 3 accents, mise en avant (portrait, produit vedette ou bannière),
 * typographie et sections masquables. Toutes les couleurs passent par des variables CSS (shop.css).
 */
export default async function ConsultantShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await getConsultantShop(slug);
  if (!shop) notFound();

  const { consultant: c, products, reviews, stats } = shop;
  const look = shopLook({ theme: c.themeId, ...c.look });
  const { theme, hero, hidden } = look;
  const show = (s: (typeof hidden)[number]) => !hidden.includes(s);

  const first = c.name.split(/\s+/)[0];
  const ref = `?ref=${c.slug}`;
  const origin = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  const wa = shopWhatsAppLink(c.whatsapp, `Bonjour ${first}, je visite votre boutique JAMAAL (${origin}/c/${c.slug}) : j'aimerais un conseil parfum.`);
  const waProduct = (name: string) =>
    shopWhatsAppLink(c.whatsapp, `Bonjour ${first}, je souhaite commander ${name} (vu sur votre boutique JAMAAL). Est-il disponible ?`);

  const myReviews = reviews.filter((r) => r.mine);
  const star = products[0];
  const tint = (i: number) => theme.tints[i % theme.tints.length];
  const tagline = c.tagline || "L'art du parfum d'exception, conseillé avec soin.";

  const services = [
    { href: `/parfum-adn${ref}`, title: "Parfum ADN", text: "Quelques questions, et trois parfums faits pour vous.", icon: Dna },
    { href: `/collections${ref}`, title: "Tout le catalogue", text: "Extraits de parfum, formats voyage, coffrets, soins.", icon: LayoutGrid },
    { href: `/skin-advisor${ref}`, title: "Diagnostic beauté", text: "Une routine de soins adaptée à votre peau.", icon: Sparkles },
    { href: `/carte-cadeau${ref}`, title: "Offrir", text: "Carte cadeau et coffrets, livrés avec votre message.", icon: Gift },
  ];

  const steps = [
    { n: "01", title: "Choisissez", text: `Parcourez les coups de cœur de ${first} ou le catalogue, ou demandez conseil.` },
    { n: "02", title: `Échangez avec ${first}`, text: "Votre parfum, le format et la livraison se confirment sur WhatsApp." },
    { n: "03", title: "Recevez et payez", text: "Livraison à domicile ou retrait. Wave, Orange Money ou à la livraison." },
  ];

  const waButton = (label: string) =>
    wa ? (
      <a href={wa} data-track="whatsapp" target="_blank" rel="noopener noreferrer" className="sh-btn sh-btn-wa">
        <WaIcon /> {label}
      </a>
    ) : null;

  // Page de garde : le logo du revendeur en haut (sinon sa photo, sinon ses initiales), le reste en dessous.
  const mark = c.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.logo} alt={`Logo de ${c.name}`} className="mx-auto block max-h-[120px] w-auto max-w-[min(320px,80%)] object-contain sm:max-h-[150px]" />
  ) : c.photo ? (
    <div className="sh-portrait mx-auto h-[168px] w-[136px] overflow-hidden sm:h-[200px] sm:w-[162px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
    </div>
  ) : (
    <div className="sh-mark mx-auto flex h-[132px] w-[132px] items-center justify-center rounded-full sm:h-[150px] sm:w-[150px]" aria-hidden="true">
      <span className="sh-display text-[54px] leading-none sm:text-[62px]">{initials(c.name)}</span>
    </div>
  );
  // Logo et photo : la photo reste visible, en petit, sous le logo (haut de page « portrait »).
  const avatar = c.logo && c.photo && hero === "portrait" ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.photo} alt={c.name} className="sh-avatar mx-auto mt-6 h-20 w-20 rounded-full object-cover" />
  ) : null;

  const starCard = hero === "showcase" && star ? (
    <Link href={`/produits/${star.slug}${ref}`} data-track="produit" data-product={star.id} className="sh-card sh-product mx-auto mt-12 flex max-w-[640px] flex-col overflow-hidden rounded-[24px] text-left sm:flex-row">
      <div className="flex aspect-square items-center justify-center p-6 sm:w-[46%]" style={{ background: tint(0) }}>
        {star.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={star.photo} alt={star.name} className="h-full w-full object-contain" />
        ) : (
          <Sparkles size={48} aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center p-6">
        <span className="sh-eyebrow text-[11px]">{shop.chosen ? `Le conseil de ${first}` : "À découvrir"}</span>
        <span className="sh-display mt-2 block text-3xl leading-tight">{star.name}</span>
        {star.inspiredBy && <span className="sh-muted mt-1 block text-sm">Inspiration : {star.inspiredBy}</span>}
        <span className="mt-3 block text-lg font-medium tabular-nums">{price(star)}</span>
      </div>
    </Link>
  ) : null;

  return (
    <div className="sh-root min-h-screen" style={look.vars as CSSProperties}>
      <ShopTracker slug={c.slug} />
      <p className="sh-band px-4 py-2.5 text-center text-[11px] uppercase tracking-[0.14em] sm:text-xs">
        Conseil et commande sur WhatsApp · Paiement Wave, Orange Money ou à la livraison
      </p>

      <header className="sh-line border-b">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <nav aria-label="Menu" className="hidden flex-1 gap-7 text-[13px] uppercase tracking-[0.12em] lg:flex">
            {show("products") && <a href="#coups-de-coeur" className="sh-link">Parfums</a>}
            {show("services") && <a href="#univers" className="sh-link">Conseil</a>}
            {show("steps") && <a href="#commander" className="sh-link">Commander</a>}
            {show("reviews") && reviews.length > 0 && <a href="#avis" className="sh-link">Avis</a>}
          </nav>
          <Link href={`/${ref}`} className="sh-link shrink-0 lg:text-center" aria-label="JAMAAL, accueil du site">
            <span className="sh-wordmark block text-[22px] sm:text-[28px]">JAMAAL</span>
            <span className="sh-acc mt-1.5 block text-[8px] tracking-[0.42em] sm:text-[10px]">LUXURY COSMETICS</span>
          </Link>
          <div className="flex items-center justify-end gap-2 sm:gap-3 lg:flex-1">
            <Link href={`/panier${ref}`} aria-label="Mon panier" className="sh-icon-btn sh-line sh-link border">
              <ShoppingBag size={18} strokeWidth={1.6} />
            </Link>
            {wa && (
              <a href={wa} data-track="whatsapp" target="_blank" rel="noopener noreferrer" className="sh-btn sh-btn-wa sh-btn-small">
                <WaIcon size={16} /> <span className="hidden sm:inline">Écrire à {first}</span>
                <span className="sm:hidden">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
        {theme.decor && <div className="sh-decor" style={{ background: theme.decor }} aria-hidden="true" />}
      </header>

      {/* Page de garde : logo en haut, puis nom, accroche, présentation, boutons ; bannière ou produit vedette au choix. */}
      {hero === "banner" ? (
        <section aria-label="Votre conseiller" className="mx-auto max-w-[1240px] px-4 pb-14 pt-6 sm:px-6 sm:pt-12">
          <div className="sh-accent-bg rounded-[28px] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className={c.logo ? "mx-auto inline-block rounded-2xl bg-white px-6 py-4" : ""}>{mark}</div>
            <p className="mt-8 text-xs uppercase tracking-[0.26em]">Votre conseiller JAMAAL · {c.city}</p>
            <h1 className="sh-display mt-4 text-[clamp(40px,7vw,80px)] leading-[1]">{c.name}</h1>
            <p className="sh-display mt-4 text-xl italic sm:text-2xl">{tagline}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {waButton(`Échanger avec ${first}`)}
              <Link href={`/parfum-adn${ref}`} className="sh-btn sh-btn-light">Trouver mon parfum</Link>
            </div>
          </div>
          {c.bio && <p className="sh-muted mx-auto mt-8 max-w-2xl text-center text-base leading-relaxed sm:text-[17px]">{c.bio}</p>}
        </section>
      ) : (
        <section aria-label="Votre conseiller" className="mx-auto max-w-[920px] px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-14">
          {mark}
          {avatar}
          <p className="sh-eyebrow mt-8">La boutique de votre conseiller JAMAAL · {c.city}</p>
          <h1 className="sh-display mt-4 text-[clamp(42px,8vw,84px)] leading-[0.98]">{c.name}</h1>
          <p className="sh-display sh-acc mt-4 text-xl italic sm:text-2xl">{tagline}</p>
          <p className="sh-muted mx-auto mt-5 max-w-[38rem] text-base leading-relaxed sm:text-[17px]">
            {c.bio || `Conseiller·e JAMAAL à ${c.city}. Dites-moi ce que vous aimez porter : je vous guide vers le parfum qui vous ressemble, et je vous le fais livrer.`}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {waButton(`Échanger avec ${first}`)}
            <Link href={`/parfum-adn${ref}`} className="sh-btn sh-btn-ghost">Trouver mon parfum en 1 minute</Link>
          </div>
          <div className="sh-line sh-muted mx-auto mt-10 flex max-w-[44rem] flex-wrap justify-center gap-x-6 gap-y-2 border-t pt-6 text-sm">
            <span>{c.title} JAMAAL</span>
            <span>Livraison à domicile ou retrait</span>
            <span>Wave · Orange Money · à la livraison</span>
            {myReviews.length > 0 && stats.rating ? <span>★ {stats.rating.toFixed(1)} · {myReviews.length} avis</span> : null}
          </div>
          {starCard}
        </section>
      )}

      {show("services") && (
        <section id="univers" aria-label="Services" className="sh-soft sh-line border-y">
          <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="sh-display text-3xl sm:text-[40px]">Comment puis-je vous aider ?</h2>
              <Link href={`/collections${ref}`} className="sh-acc text-sm uppercase tracking-[0.1em] hover:underline">Tout le catalogue</Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {services.map((s) => (
                <Link key={s.href} href={s.href} className="sh-card flex min-h-[170px] flex-col gap-3 rounded-2xl p-6">
                  <s.icon size={26} strokeWidth={1.4} className="sh-acc" aria-hidden="true" />
                  <span className="sh-display text-2xl leading-tight">{s.title}</span>
                  <span className="sh-muted text-sm leading-relaxed">{s.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {show("products") && (
        <section id="coups-de-coeur" aria-label="Coups de cœur" className="mx-auto max-w-[1240px] px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
          <p className="sh-eyebrow text-center">{shop.chosen ? "Sélection personnelle" : "Les plus demandés"}</p>
          <h2 className="sh-display mt-3 text-center text-[clamp(32px,5vw,48px)] leading-tight">
            {shop.chosen ? `Les coups de cœur de ${first}` : "Les parfums du moment"}
          </h2>
          {products.length > 0 ? (
            <div className="sh-grid-products mt-10 sm:mt-12">
              {products.map((p, i) => {
                const ask = waProduct(p.name);
                return (
                  <article key={p.id} className="sh-card sh-product flex flex-col overflow-hidden rounded-[18px]">
                    <Link href={`/produits/${p.slug}${ref}`} data-track="produit" data-product={p.id} className="flex aspect-square items-center justify-center overflow-hidden p-5" style={{ background: tint(i) }} tabIndex={-1} aria-hidden="true">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <Sparkles size={36} />
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
                      <Link href={`/produits/${p.slug}${ref}`} data-track="produit" data-product={p.id} className="sh-link sh-display text-lg leading-snug sm:text-[22px]">{p.name}</Link>
                      {p.inspiredBy && <span className="sh-muted line-clamp-2 text-[13px]">Inspiration : {p.inspiredBy}</span>}
                      <span className="mt-2 text-[15px] font-medium tabular-nums">{price(p)}</span>
                      <div className="mt-auto flex gap-2 pt-3">
                        <Link href={`/produits/${p.slug}${ref}`} data-track="produit" data-product={p.id} className="sh-btn sh-btn-primary sh-btn-small min-w-0 flex-1 px-3">Commander</Link>
                        {ask && (
                          <a href={ask} data-track="whatsapp" target="_blank" rel="noopener noreferrer" aria-label={`Demander ${p.name} sur WhatsApp`} className="sh-icon-btn sh-btn-wa">
                            <WaIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="sh-muted py-10 text-center text-sm">La sélection arrive bientôt.</p>
          )}
          <div className="mt-10 text-center">
            <Link href={`/collections${ref}`} className="sh-underline inline-block">Découvrir tout le catalogue JAMAAL</Link>
          </div>
        </section>
      )}

      {show("steps") && (
        <section id="commander" aria-label="Comment commander" className="sh-dark">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-[72px]">
            <h2 className="sh-display text-center text-[clamp(30px,4.5vw,42px)]">Commander, simplement</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="sh-dark-rule pt-5">
                  <div className="sh-display sh-dark-acc text-4xl leading-none">{s.n}</div>
                  <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed opacity-90">{s.text}</p>
                </div>
              ))}
            </div>
            {wa && <div className="mt-10 text-center">{waButton(`Commander avec ${first}`)}</div>}
          </div>
        </section>
      )}

      {show("reviews") && reviews.length > 0 && (
        <section id="avis" aria-label="Avis clients" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="sh-display text-center text-[clamp(30px,4.5vw,42px)]">
            {myReviews.length > 0 ? `Ils ont commandé avec ${first}` : "Ils ont choisi JAMAAL"}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="sh-card m-0 rounded-2xl p-6">
                <div className="sh-stars text-[15px]" aria-label={`${r.rating} étoiles sur 5`}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(Math.max(0, 5 - r.rating))}
                </div>
                <blockquote className="sh-display mt-3 text-xl italic leading-snug">« {r.comment} »</blockquote>
                <figcaption className="sh-muted mt-4 text-sm">{r.author} · {r.product}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer id="contact" className="sh-footer">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-10 px-4 pb-8 pt-14 sm:px-6">
          <div className="flex-[1_1_260px]">
            <div className="sh-wordmark text-2xl" style={{ paddingLeft: 0 }}>JAMAAL</div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed">Parfums et soins de la Maison JAMAAL, conseillés et livrés par votre conseiller.</p>
          </div>
          <div className="flex-[1_1_200px] text-sm leading-8">
            <p className="text-[11px] uppercase tracking-[0.24em]">Votre conseiller</p>
            <p>{c.name} · {c.city}</p>
            {wa && <a href={wa} data-track="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp : {c.whatsapp}</a>}
          </div>
          <div className="flex-[1_1_200px] text-sm leading-8">
            <p className="text-[11px] uppercase tracking-[0.24em]">La Maison</p>
            <p><Link href={`/collections${ref}`}>Catalogue complet</Link></p>
            <p><Link href={`/carte-cadeau${ref}`}>Carte cadeau</Link></p>
            <p><Link href={`/devenir-consultant${ref}`}>Devenir conseiller</Link></p>
          </div>
        </div>
        <p className="mx-auto max-w-[1240px] px-4 pb-7 pt-5 text-xs sm:px-6">
          © {new Date().getFullYear()} JAMAAL Luxury Cosmetics · Boutique de {c.name}, conseiller·e agréé·e
        </p>
      </footer>
    </div>
  );
}
