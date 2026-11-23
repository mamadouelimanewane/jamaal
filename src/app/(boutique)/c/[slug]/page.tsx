import type { Metadata } from "next";
import { MediaView } from "@/components/MediaView";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Dna, Gift, LayoutGrid, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import { getConsultantShop, shopWhatsAppLink } from "@/lib/shop/consultant-shop";
import { priceLabel } from "@/lib/share-text";
import { translator, type T } from "@/lib/i18n/translate";
import { isMauritanianNumber } from "@/lib/phone-country";
import { formatMru } from "@/lib/currency";
import { getMruRate } from "@/lib/fx";
import { getSiteUrl } from "@/lib/site-url";
import { shopLook } from "@/lib/shop/themes";
import { ShopTracker } from "@/components/shop/ShopTracker";
import "./shop.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string }> };

type ShopLang = "fr" | "ar";

/**
 * Langue de la boutique : arabe d'office quand le revendeur a un numéro mauritanien (+222),
 * français sinon ; le visiteur peut changer avec ?lang=fr ou ?lang=ar.
 */
function shopLang(whatsapp: string, asked?: string): ShopLang {
  if (asked === "fr" || asked === "ar") return asked;
  return isMauritanianNumber(whatsapp) ? "ar" : "fr";
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const shop = await getConsultantShop(slug).catch(() => null);
  if (!shop) return { title: "Boutique JAMAAL" };
  const t = translator(shopLang(shop.consultant.whatsapp, sp.lang));
  const first = shop.consultant.shopName ?? shop.consultant.name.split(/\s+/)[0];
  const description =
    (shop.consultant.bio ? shop.consultant.bio.replace(/\s+/g, " ").slice(0, 160) : "") ||
    shop.consultant.tagline ||
    t("La boutique de {v0}, conseiller·e JAMAAL à {v1} : conseil parfum, commande sur WhatsApp et livraison.", { v0: first, v1: shop.consultant.city });
  const title = shop.consultant.shopName ?? t("La boutique de {v0}", { v0: first });
  return {
    title,
    description,
    openGraph: {
      title: `${title} · JAMAAL`,
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

const priceIn = (lang: ShopLang, t: T, mruRate: number) => (p: { price: number | null; multiFormat: boolean }) =>
  !p.price
    ? t("Prix sur demande")
    : lang === "ar"
      ? `${p.multiFormat ? `${t("À partir de")} ` : ""}${formatMru(p.price, mruRate)}`
      : priceLabel(p.price, p.multiFormat).replace(/^à/, "À");

function WaIcon({ size = 18 }: { size?: number }) {
  return <MessageCircle size={size} strokeWidth={1.8} aria-hidden="true" />;
}

/**
 * Boutique personnelle du conseiller (lien de bio Instagram / TikTok), habillée par le thème qu'il a choisi
 * dans Ma boutique : 14 thèmes, 3 accents, mise en avant (portrait, produit vedette ou bannière),
 * typographie et sections masquables. Toutes les couleurs passent par des variables CSS (shop.css).
 */
export default async function ConsultantShopPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const shop = await getConsultantShop(slug);
  if (!shop) notFound();

  const { consultant: c, products, reviews, stats } = shop;
  const look = shopLook({ theme: c.themeId, ...c.look });
  const { theme, hero, hidden } = look;
  const show = (s: (typeof hidden)[number]) => !hidden.includes(s);

  // Nom de boutique rempli : il remplace partout le nom (et le prénom) du revendeur.
  const first = c.shopName ?? c.name.split(/\s+/)[0];
  // Numéro mauritanien : boutique proposée en arabe, prix en ouguiya ; bouton FR / ع pour changer.
  const lang = shopLang(c.whatsapp, sp.lang);
  const ar = lang === "ar";
  const offerArabic = ar || isMauritanianNumber(c.whatsapp);
  const t = translator(lang);
  const price = priceIn(lang, t, ar ? await getMruRate() : 0);
  const ref = `?ref=${c.slug}`;
  // Liens vers le site : version arabe (/ar/…) quand la boutique est en arabe.
  const site = ar ? "/ar" : "";
  const origin = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  const wa = shopWhatsAppLink(c.whatsapp, t("Bonjour {v0}, je visite votre boutique JAMAAL ({v1}) : j'aimerais un conseil parfum.", { v0: first, v1: `${origin}/c/${c.slug}` }));
  const waProduct = (name: string) =>
    shopWhatsAppLink(c.whatsapp, t("Bonjour {v0}, je souhaite commander {v1} (vu sur votre boutique JAMAAL). Est-il disponible ?", { v0: first, v1: name }));

  const myReviews = reviews.filter((r) => r.mine);
  const star = products[0];
  const tint = (i: number) => theme.tints[i % theme.tints.length];
  const tagline = c.tagline || t("L'art du parfum d'exception, conseillé avec soin.");

  const services = [
    { href: `${site}/parfum-adn${ref}`, title: t("Parfum ADN"), text: t("Quelques questions, et trois parfums faits pour vous."), icon: Dna },
    { href: `${site}/collections${ref}`, title: t("Tout le catalogue"), text: t("Extraits de parfum, formats voyage, coffrets, soins."), icon: LayoutGrid },
    { href: `${site}/skin-advisor${ref}`, title: t("Diagnostic beauté"), text: t("Une routine de soins adaptée à votre peau."), icon: Sparkles },
    { href: `${site}/carte-cadeau${ref}`, title: t("Offrir"), text: t("Carte cadeau et coffrets, livrés avec votre message."), icon: Gift },
  ];

  const steps = [
    { n: "01", title: t("Choisissez"), text: t("Parcourez les coups de cœur de {v0} ou le catalogue, ou demandez conseil.", { v0: first }) },
    { n: "02", title: t("Échangez avec {v0}", { v0: first }), text: t("Votre parfum, le format et la livraison se confirment sur WhatsApp.") },
    { n: "03", title: t("Recevez et payez"), text: t("Livraison à domicile ou retrait. Wave, Orange Money ou à la livraison.") },
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
    <img src={c.logo} alt={t("Logo de {v0}", { v0: c.name })} className="mx-auto block h-[180px] w-auto max-w-[min(460px,92%)] object-contain sm:h-[240px]" />
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
    <Link href={`${site}/produits/${star.slug}${ref}`} data-track="produit" data-product={star.id} className="sh-card sh-product mx-auto mt-12 flex max-w-[640px] flex-col overflow-hidden rounded-[24px] text-start sm:flex-row">
      <div className="flex aspect-square items-center justify-center p-6 sm:w-[46%]" style={{ background: tint(0) }}>
        {star.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={star.photo} alt={star.name} className="h-full w-full object-contain" />
        ) : (
          <Sparkles size={48} aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center p-6">
        <span className="sh-eyebrow text-[11px]">{shop.chosen ? t("Le conseil de {v0}", { v0: first }) : t("À découvrir")}</span>
        <span className="sh-display mt-2 block text-3xl leading-tight">{star.name}</span>
        {star.inspiredBy && <span className="sh-muted mt-1 block text-sm">{t("Inspiration :")} {star.inspiredBy}</span>}
        <span className="mt-3 block text-lg font-medium tabular-nums">{price(star)}</span>
      </div>
    </Link>
  ) : null;

  return (
    <div className="sh-root min-h-screen" lang={lang} dir={ar ? "rtl" : "ltr"} style={look.vars as CSSProperties}>
      <ShopTracker slug={c.slug} />
      <p className="sh-band px-4 py-2.5 text-center text-[11px] uppercase tracking-[0.14em] sm:text-xs">
        {t("Conseil et commande sur WhatsApp · Paiement Wave, Orange Money ou à la livraison")}
        {offerArabic && (
          <span dir="ltr" className="ms-3 inline-flex gap-1 align-middle normal-case tracking-normal">
            <Link href={`/c/${c.slug}?lang=fr`} aria-current={!ar ? "true" : undefined} className={`rounded-full px-2 py-0.5 ${!ar ? "bg-white/25 font-semibold" : "opacity-80 hover:opacity-100"}`} lang="fr">FR</Link>
            <Link href={`/c/${c.slug}?lang=ar`} aria-current={ar ? "true" : undefined} className={`rounded-full px-2 py-0.5 ${ar ? "bg-white/25 font-semibold" : "opacity-80 hover:opacity-100"}`} lang="ar">العربية</Link>
          </span>
        )}
      </p>

      <header className="sh-line border-b">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <nav aria-label={t("Menu")} className="hidden flex-1 gap-7 text-[13px] uppercase tracking-[0.12em] lg:flex">
            {show("products") && <a href="#coups-de-coeur" className="sh-link">{t("Parfums")}</a>}
            {show("services") && <a href="#univers" className="sh-link">{t("Conseil")}</a>}
            {show("steps") && <a href="#commander" className="sh-link">{t("Commander")}</a>}
            {show("reviews") && reviews.length > 0 && <a href="#avis" className="sh-link">{t("Avis")}</a>}
          </nav>
          <Link href={`${site || "/"}${ref}`} className="sh-link shrink-0 lg:text-center" aria-label={t("JAMAAL, accueil du site")}>
            <span className="sh-wordmark block text-[22px] sm:text-[28px]">JAMAAL</span>
            <span className="sh-acc mt-1.5 block text-[8px] tracking-[0.42em] sm:text-[10px]">LUXURY COSMETICS</span>
          </Link>
          <div className="flex items-center justify-end gap-2 sm:gap-3 lg:flex-1">
            <Link href={`${site}/panier${ref}`} aria-label={t("Mon panier")} className="sh-icon-btn sh-line sh-link border">
              <ShoppingBag size={18} strokeWidth={1.6} />
            </Link>
            {wa && (
              <a href={wa} data-track="whatsapp" target="_blank" rel="noopener noreferrer" className="sh-btn sh-btn-wa sh-btn-small">
                <WaIcon size={16} /> <span className="hidden sm:inline">{t("Écrire à {v0}", { v0: first })}</span>
                <span className="sm:hidden">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
        {theme.decor && <div className="sh-decor" style={{ background: theme.decor }} aria-hidden="true" />}
      </header>

      {/* Page de garde : logo en haut, puis nom, accroche, présentation, boutons ; bannière ou produit vedette au choix. */}
      {hero === "banner" ? (
        <section aria-label={t("Votre conseiller")} className="mx-auto max-w-[1240px] px-4 pb-14 pt-6 sm:px-6 sm:pt-12">
          <div className="sh-accent-bg rounded-[28px] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className={c.logo ? "mx-auto inline-block rounded-2xl bg-white px-6 py-4" : ""}>{mark}</div>
            <p className="mt-8 text-xs uppercase tracking-[0.26em]">{c.shopName ? t("Votre boutique JAMAAL") : t("Votre conseiller JAMAAL")} · {c.city}</p>
            <h1 className="sh-display mt-4 text-[clamp(40px,7vw,80px)] leading-[1]">{c.name}</h1>
            <p className="sh-display mt-4 text-xl italic sm:text-2xl">{tagline}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {waButton(t("Échanger avec {v0}", { v0: first }))}
              <Link href={`${site}/parfum-adn${ref}`} className="sh-btn sh-btn-light">{t("Trouver mon parfum")}</Link>
            </div>
          </div>
          {c.bio && <p className="sh-muted mx-auto mt-8 max-w-2xl whitespace-pre-line text-center text-base leading-relaxed sm:text-[17px]">{c.bio}</p>}
        </section>
      ) : (
        <section aria-label={t("Votre conseiller")} className="mx-auto max-w-[920px] px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-14">
          {mark}
          {avatar}
          <p className="sh-eyebrow mt-8">{c.shopName ? t("Boutique JAMAAL") : t("La boutique de votre conseiller JAMAAL")} · {c.city}</p>
          <h1 className="sh-display mt-4 text-[clamp(42px,8vw,84px)] leading-[0.98]">{c.name}</h1>
          <p className="sh-display sh-acc mt-4 text-xl italic sm:text-2xl">{tagline}</p>
          <p className="sh-muted mx-auto mt-5 max-w-[38rem] whitespace-pre-line text-base leading-relaxed sm:text-[17px]">
            {c.bio || `${c.shopName ? t("{v0}, boutique JAMAAL à {v1}.", { v0: c.shopName, v1: c.city }) : t("Conseiller·e JAMAAL à {v0}.", { v0: c.city })} ${t("Dites-moi ce que vous aimez porter : je vous guide vers le parfum qui vous ressemble, et je vous le fais livrer.")}`}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {waButton(t("Échanger avec {v0}", { v0: first }))}
            <Link href={`${site}/parfum-adn${ref}`} className="sh-btn sh-btn-ghost">{t("Trouver mon parfum en 1 minute")}</Link>
          </div>
          <div className="sh-line sh-muted mx-auto mt-10 flex max-w-[44rem] flex-wrap justify-center gap-x-6 gap-y-2 border-t pt-6 text-sm">
            <span>{t(c.title)} JAMAAL</span>
            <span>{t("Livraison à domicile ou retrait")}</span>
            <span>{t("Wave · Orange Money · à la livraison")}</span>
            {myReviews.length > 0 && stats.rating ? <span>★ {stats.rating.toFixed(1)} · {t("{n} avis", { n: myReviews.length })}</span> : null}
          </div>
          {starCard}
        </section>
      )}

      {c.media?.length ? (
        <section id="galerie" aria-label={t("Photos et vidéos")} className="mx-auto max-w-[1240px] px-4 pb-14 sm:px-6 sm:pb-16">
          <h2 className="sh-display text-center text-3xl sm:text-[40px]">{t("En photos et en vidéos")}</h2>
          <ul className={`mt-8 grid gap-3 sm:gap-4 ${c.media.length === 1 ? "mx-auto max-w-md grid-cols-1" : "grid-cols-2 lg:grid-cols-3"}`}>
            {c.media.map((m, i) => (
              <li key={m} className="sh-card overflow-hidden rounded-[20px]">
                <MediaView src={m} alt={`${c.name} — ${i + 1}`} className="aspect-[4/5] h-auto w-full bg-black/5" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {show("services") && (
        <section id="univers" aria-label={t("Services")} className="sh-soft sh-line border-y">
          <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="sh-display text-3xl sm:text-[40px]">{t("Comment puis-je vous aider ?")}</h2>
              <Link href={`${site}/collections${ref}`} className="sh-acc text-sm uppercase tracking-[0.1em] hover:underline">{t("Tout le catalogue")}</Link>
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
        <section id="coups-de-coeur" aria-label={t("Coups de cœur")} className="mx-auto max-w-[1240px] px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
          <p className="sh-eyebrow text-center">{shop.chosen ? t("Sélection personnelle") : t("Les plus demandés")}</p>
          <h2 className="sh-display mt-3 text-center text-[clamp(32px,5vw,48px)] leading-tight">
            {shop.chosen ? t("Les coups de cœur de {v0}", { v0: first }) : t("Les parfums du moment")}
          </h2>
          {products.length > 0 ? (
            <div className="sh-grid-products mt-10 sm:mt-12">
              {products.map((p, i) => {
                const ask = waProduct(p.name);
                return (
                  <article key={p.id} className="sh-card sh-product flex flex-col overflow-hidden rounded-[18px]">
                    <Link href={`${site}/produits/${p.slug}${ref}`} data-track="produit" data-product={p.id} className="flex aspect-square items-center justify-center overflow-hidden p-5" style={{ background: tint(i) }} tabIndex={-1} aria-hidden="true">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <Sparkles size={36} />
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
                      <Link href={`${site}/produits/${p.slug}${ref}`} data-track="produit" data-product={p.id} className="sh-link sh-display text-lg leading-snug sm:text-[22px]">{p.name}</Link>
                      {p.inspiredBy && <span className="sh-muted line-clamp-2 text-[13px]">{t("Inspiration :")} {p.inspiredBy}</span>}
                      <span className="mt-2 text-[15px] font-medium tabular-nums">{price(p)}</span>
                      {p.inStock ? (
                        // Boutique en arabe (clientèle mauritanienne) : pas de « Disponible à Dakar ».
                        ar ? null : <span className="text-[13px] font-medium text-emerald-700">{t("Disponible à Dakar")}</span>
                      ) : (
                        <span className="text-[13px] leading-snug"><strong>{t("En rupture")}</strong> · {t("vous pouvez réserver ce produit")}</span>
                      )}
                      <div className="mt-auto flex gap-2 pt-3">
                        <Link href={`${site}/produits/${p.slug}${ref}`} data-track="produit" data-product={p.id} className="sh-btn sh-btn-primary sh-btn-small min-w-0 flex-1 px-3">{p.inStock ? t("Commander") : t("Réserver")}</Link>
                        {ask && (
                          <a href={ask} data-track="whatsapp" target="_blank" rel="noopener noreferrer" aria-label={t("Demander {v0} sur WhatsApp", { v0: p.name })} className="sh-icon-btn sh-btn-wa">
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
            <p className="sh-muted py-10 text-center text-sm">{t("La sélection arrive bientôt.")}</p>
          )}
          <div className="mt-10 text-center">
            <Link href={`${site}/collections${ref}`} className="sh-underline inline-block">{t("Découvrir tout le catalogue JAMAAL")}</Link>
          </div>
        </section>
      )}

      {show("steps") && (
        <section id="commander" aria-label={t("Comment commander")} className="sh-dark">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-[72px]">
            <h2 className="sh-display text-center text-[clamp(30px,4.5vw,42px)]">{t("Commander, simplement")}</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="sh-dark-rule pt-5">
                  <div className="sh-display sh-dark-acc text-4xl leading-none">{s.n}</div>
                  <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed opacity-90">{s.text}</p>
                </div>
              ))}
            </div>
            {wa && <div className="mt-10 text-center">{waButton(t("Commander avec {v0}", { v0: first }))}</div>}
          </div>
        </section>
      )}

      {show("reviews") && reviews.length > 0 && (
        <section id="avis" aria-label={t("Avis clients")} className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="sh-display text-center text-[clamp(30px,4.5vw,42px)]">
            {myReviews.length > 0 ? t("Ils ont commandé avec {v0}", { v0: first }) : t("Ils ont choisi JAMAAL")}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="sh-card m-0 rounded-2xl p-6">
                <div className="sh-stars text-[15px]" aria-label={t("{n} étoiles sur 5", { n: r.rating })}>
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
            <p className="mt-3 max-w-xs text-sm leading-relaxed">{t("Parfums et soins de la Maison JAMAAL, conseillés et livrés par votre conseiller.")}</p>
          </div>
          <div className="flex-[1_1_200px] text-sm leading-8">
            <p className="text-[11px] uppercase tracking-[0.24em]">{c.shopName ? t("La boutique") : t("Votre conseiller")}</p>
            <p>{c.name} · {c.city}</p>
            {wa && <a href={wa} data-track="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp : <span dir="ltr">{c.whatsapp}</span></a>}
          </div>
          <div className="flex-[1_1_200px] text-sm leading-8">
            <p className="text-[11px] uppercase tracking-[0.24em]">{t("La Maison")}</p>
            <p><Link href={`${site}/collections${ref}`}>{t("Catalogue complet")}</Link></p>
            <p><Link href={`${site}/carte-cadeau${ref}`}>{t("Carte cadeau")}</Link></p>
            <p><Link href={`${site}/devenir-consultant${ref}`}>{t("Devenir conseiller")}</Link></p>
          </div>
        </div>
        <p className="mx-auto max-w-[1240px] px-4 pb-7 pt-5 text-xs sm:px-6">
          © {new Date().getFullYear()} JAMAAL Luxury Cosmetics · {c.shopName ? t("{v0}, boutique agréée", { v0: c.shopName }) : t("Boutique de {v0}, conseiller·e agréé·e", { v0: c.name })}
        </p>
      </footer>
    </div>
  );
}
